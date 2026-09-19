"""Local, synthetic storage challenge/response drill. No service or wallet access.

Run from the repository root:
    python -m tools.participation_simulator --enable-synthetic-demo

The coordinator and node have separate storage but run on one trusted machine.
This is a protocol/credit-accounting simulator, not proof of durable storage,
independent operators, authenticated users, or a production-ready network.
"""

from __future__ import annotations

import argparse
from contextlib import contextmanager
from dataclasses import asdict, dataclass, replace
import hashlib
import hmac
import json
from pathlib import Path
import re
import secrets
import sqlite3
import tempfile
import time
from typing import Callable, Iterator


ROOT = Path(__file__).resolve().parents[1]
SPEC = json.loads(
    (ROOT / "contracts/participation/v1/simulator.json").read_text(encoding="utf-8")
)
DAY = 86400


class SimulationError(ValueError):
    """A bounded rejection code without user data or local paths."""


def canonical(value: object) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=True, allow_nan=False).encode("ascii")


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


# Deliberately invented records, without personal data or imported OFF/USDA data.
# There is no external-file, URL, database, or arbitrary-input admission path.
FIXTURES = {
    name: canonical({
        "schema_version": "caloriedb.synthetic-public-shard.v1",
        "synthetic": True,
        "records": [{"id": "synthetic-" + name, "label": "Demo " + name}],
    })
    for name in ("apple", "bread", "water")
}
FIXTURES["vegetable-catalog"] = canonical({
    "schema_version": "caloriedb.synthetic-public-shard.v1",
    "synthetic": True,
    "records": [
        {"id": "synthetic-" + name, "label": "Demo " + name}
        for name in ("carrot", "broccoli", "spinach", "pepper", "cabbage")
    ],
})
PAYLOADS = {digest(value): value for value in FIXTURES.values()}


def _integer(value: int, minimum: int, maximum: int) -> bool:
    return type(value) is int and minimum <= value <= maximum


def _enabled(enabled: bool) -> None:
    if enabled is not True:
        raise SimulationError("simulation-disabled")


@dataclass(frozen=True)
class Consent:
    storage: bool = False
    compute: bool = False
    rewards: bool = False
    paused: bool = False
    pause_until: int | None = None
    storage_limit_bytes: int = 4096
    transfer_limit_bytes: int = 8192

    def __post_init__(self) -> None:
        if any(type(value) is not bool for value in
               (self.storage, self.compute, self.rewards, self.paused)):
            raise SimulationError("invalid-consent")
        if not _integer(self.storage_limit_bytes, 0, SPEC["max_storage_bytes"]):
            raise SimulationError("invalid-storage-limit")
        if not _integer(self.transfer_limit_bytes, 0, SPEC["max_transfer_bytes_per_run"]):
            raise SimulationError("invalid-transfer-limit")
        if self.pause_until is not None and (
                not self.paused or not _integer(self.pause_until, 0, 2**53 - 1)):
            raise SimulationError("invalid-pause-until")

    def is_paused(self, now: int) -> bool:
        return self.paused and (self.pause_until is None or now < self.pause_until)


def _pause(consent: Consent, until: int | None, now: int) -> Consent:
    if not consent.storage and not consent.compute:
        raise SimulationError("participation-not-consented")
    if until is not None and (type(until) is not int or until <= now):
        raise SimulationError("pause-end-must-be-in-the-future")
    return replace(consent, paused=True, pause_until=until)


def _stop(consent: Consent) -> Consent:
    return replace(consent, storage=False, compute=False, rewards=False,
                   paused=False, pause_until=None)


@dataclass(frozen=True)
class Manifest:
    schema_version: str
    classification: str
    sha256: str
    byte_length: int


def manifest_for(name: str) -> Manifest:
    if name not in FIXTURES:
        raise SimulationError("synthetic-fixture-required")
    payload = FIXTURES[name]
    return Manifest("caloriedb.synthetic-public-shard.v1", "synthetic-public",
                    digest(payload), len(payload))


def _payload(manifest: Manifest) -> bytes:
    value = PAYLOADS.get(manifest.sha256)
    if (value is None or manifest.schema_version != "caloriedb.synthetic-public-shard.v1"
            or manifest.classification != "synthetic-public"
            or type(manifest.byte_length) is not int or manifest.byte_length != len(value)):
        raise SimulationError("synthetic-fixture-required")
    return value


@dataclass(frozen=True)
class Challenge:
    schema_version: str
    task_type: str
    challenge_id: str
    participant_id: str
    shard: Manifest
    nonce: str
    issued_at: int
    expires_at: int
    consent_revision: int


@dataclass(frozen=True)
class Proof:
    challenge_id: str
    response_sha256: str


@dataclass(frozen=True)
class Receipt:
    status: str
    verified: bool = False
    credited_units: int = 0
    unit: str = "CALT_SIMULATED"


def storage_response(challenge: Challenge, stored_bytes: bytes) -> str:
    # The response uses the actual bytes, not just the published shard digest.
    # Canonical, domain-separated framing binds nonce, task, owner and revision.
    return digest(SPEC["proof_domain"].encode("ascii") + b"\0"
                  + canonical(asdict(challenge)) + b"\0" + stored_bytes)


class VolunteerNode:
    """Single-process node with explicit consent and per-run byte budgets."""

    def __init__(self, directory: Path, *, enabled: bool = False,
                 consent: Consent = Consent(), clock: Callable[[], float] = time.time) -> None:
        _enabled(enabled)
        self.directory = directory
        self.consent = consent
        self.clock = clock
        self.transferred_bytes = 0
        directory.mkdir(parents=True, exist_ok=True)

    def _active(self, now: int | None = None) -> None:
        if not self.consent.storage or self.consent.is_paused(
                int(self.clock()) if now is None else now):
            raise SimulationError("storage-not-consented-or-paused")

    def pause(self, *, until: int | None = None) -> None:
        self.consent = _pause(self.consent, until, int(self.clock()))

    def resume(self) -> None:
        self.consent = replace(self.consent, paused=False, pause_until=None)

    def stop(self, *, delete_local_shards: bool = True) -> None:
        self.consent = _stop(self.consent)
        if delete_local_shards:
            for name in FIXTURES:
                self.remove(manifest_for(name))

    def _path(self, manifest: Manifest) -> Path:
        _payload(manifest)
        path = self.directory / (manifest.sha256 + ".shard")
        if path.is_symlink():
            raise SimulationError("invalid-shard-file")
        return path

    def _stored_bytes(self) -> int:
        size = 0
        for shard_digest in PAYLOADS:
            path = self.directory / (shard_digest + ".shard")
            if path.is_symlink():
                raise SimulationError("invalid-shard-file")
            if path.exists():
                size += path.stat().st_size
        return size

    def _transfer(self, byte_count: int) -> None:
        if self.transferred_bytes + byte_count > self.consent.transfer_limit_bytes:
            raise SimulationError("transfer-budget-exceeded")

    def store(self, manifest: Manifest, supplied_bytes: bytes) -> None:
        self._active()
        expected = _payload(manifest)
        if type(supplied_bytes) is not bytes or supplied_bytes != expected:
            raise SimulationError("shard-integrity-failed")
        path = self._path(manifest)
        additional = 0 if path.exists() else len(supplied_bytes)
        if self._stored_bytes() + additional > self.consent.storage_limit_bytes:
            raise SimulationError("storage-budget-exceeded")
        self._transfer(len(supplied_bytes))
        if path.exists():
            self._read(manifest)
        else:
            with path.open("xb") as handle:
                handle.write(supplied_bytes)
        self.transferred_bytes += len(supplied_bytes)

    def _read(self, manifest: Manifest) -> bytes:
        path = self._path(manifest)
        try:
            with path.open("rb") as handle:
                value = handle.read(manifest.byte_length + 1)
        except FileNotFoundError:
            raise SimulationError("shard-missing") from None
        if len(value) != manifest.byte_length or digest(value) != manifest.sha256:
            raise SimulationError("shard-integrity-failed")
        return value

    def prove(self, challenge: Challenge, *, now: int) -> Proof:
        self._active(now)
        if (challenge.schema_version != SPEC["schema_version"]
                or challenge.task_type != SPEC["task_type"]):
            raise SimulationError("unsupported-challenge")
        if not challenge.issued_at <= now < challenge.expires_at:
            raise SimulationError("challenge-outside-window")
        if self._stored_bytes() > self.consent.storage_limit_bytes:
            raise SimulationError("storage-budget-exceeded")
        value = self._read(challenge.shard)
        proof = Proof(challenge.challenge_id, storage_response(challenge, value))
        cost = len(canonical(asdict(proof)))
        self._transfer(cost)
        self.transferred_bytes += cost
        return proof

    def remove(self, manifest: Manifest) -> None:
        """Explicit local cleanup remains available after pause/withdrawal."""
        self._path(manifest).unlink(missing_ok=True)


class Coordinator:
    """Synthetic identities and atomic off-chain receipts in a separate SQLite file.

    The caller's participant_id models trusted authentication context. It is not
    authentication. Never expose these methods as network endpoints unchanged.
    """

    def __init__(self, database: Path, *, enabled: bool = False,
                 clock: Callable[[], float] = time.time) -> None:
        _enabled(enabled)
        self.database = database
        self.clock = clock
        with self._connection() as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS participants (
                    id TEXT PRIMARY KEY, age_band TEXT NOT NULL,
                    consent TEXT NOT NULL, revision INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS challenges (
                    id TEXT PRIMARY KEY, participant_id TEXT NOT NULL,
                    challenge TEXT NOT NULL, state TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS credits (
                    participant_id TEXT NOT NULL, shard_digest TEXT NOT NULL,
                    window_start INTEGER NOT NULL, challenge_id TEXT NOT NULL UNIQUE,
                    units INTEGER NOT NULL CHECK(units > 0),
                    PRIMARY KEY(participant_id, shard_digest, window_start));
            """)

    @contextmanager
    def _connection(self) -> Iterator[sqlite3.Connection]:
        db = sqlite3.connect(self.database, isolation_level=None, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            yield db
        finally:
            db.close()

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        with self._connection() as db:
            db.execute("BEGIN IMMEDIATE")
            try:
                yield db
                db.execute("COMMIT")
            except BaseException:
                db.execute("ROLLBACK")
                raise

    def _now(self) -> int:
        now = int(self.clock())
        if now < 0:
            raise SimulationError("invalid-clock")
        return now

    @staticmethod
    def _participant(db: sqlite3.Connection, participant_id: str) -> sqlite3.Row:
        row = db.execute("SELECT * FROM participants WHERE id=?", (participant_id,)).fetchone()
        if row is None:
            raise SimulationError("unknown-participant")
        return row

    def register(self, participant_id: str, *, age_band: str) -> None:
        if not re.fullmatch(r"sim-[a-z0-9-]{1,40}", participant_id):
            raise SimulationError("synthetic-identity-required")
        if age_band not in ("child", "teen", "adult"):
            raise SimulationError("invalid-age-band")
        with self._transaction() as db:
            db.execute("INSERT INTO participants VALUES (?, ?, ?, 0)",
                       (participant_id, age_band, canonical(asdict(Consent())).decode("ascii")))

    def set_consent(self, participant_id: str, consent: Consent) -> None:
        if not isinstance(consent, Consent):
            raise SimulationError("invalid-consent")
        self._change_consent(participant_id, lambda previous: consent)

    def _change_consent(self, participant_id: str,
                        change: Callable[[Consent], Consent]) -> None:
        with self._transaction() as db:
            participant = self._participant(db, participant_id)
            consent = change(Consent(**json.loads(participant["consent"])))
            # Every change invalidates pending challenges, including pause/resume
            # and withdraw/re-opt-in. Previously earned receipts remain unchanged.
            db.execute("UPDATE participants SET consent=?, revision=revision+1 WHERE id=?",
                       (canonical(asdict(consent)).decode("ascii"), participant_id))

    def pause(self, participant_id: str, *, until: int | None = None) -> None:
        self._change_consent(participant_id, lambda consent: _pause(consent, until, self._now()))

    def resume(self, participant_id: str) -> None:
        self._change_consent(participant_id, lambda consent: replace(
            consent, paused=False, pause_until=None))

    def stop(self, participant_id: str) -> None:
        self._change_consent(participant_id, _stop)

    def issue(self, participant_id: str, fixture: str) -> Challenge:
        manifest = manifest_for(fixture)
        with self._transaction() as db:
            row = self._participant(db, participant_id)
            consent = Consent(**json.loads(row["consent"]))
            now = self._now()
            if not consent.storage or consent.is_paused(now):
                raise SimulationError("storage-not-consented-or-paused")
            if manifest.byte_length > consent.storage_limit_bytes:
                raise SimulationError("storage-budget-exceeded")
            if manifest.byte_length > consent.transfer_limit_bytes:
                raise SimulationError("transfer-budget-exceeded")
            expires = min(now + SPEC["challenge_ttl_seconds"], (now // DAY + 1) * DAY)
            challenge = Challenge(
                SPEC["schema_version"], SPEC["task_type"], "sim-" + secrets.token_hex(16),
                participant_id, manifest, secrets.token_hex(32), now, expires, row["revision"],
            )
            db.execute("INSERT INTO challenges VALUES (?, ?, ?, 'pending')",
                       (challenge.challenge_id, participant_id,
                        canonical(asdict(challenge)).decode("ascii")))
            return challenge

    def verify(self, participant_id: str, proof: Proof) -> Receipt:
        # Owner, consent, one-time consumption, deduplication and cap are checked
        # under one write lock, including concurrent submissions/restarts.
        with self._transaction() as db:
            row = db.execute("SELECT * FROM challenges WHERE id=?", (proof.challenge_id,)).fetchone()
            if row is None or row["participant_id"] != participant_id:
                return Receipt("unknown-challenge-or-owner")
            if row["state"] != "pending":
                return Receipt("already-consumed")
            saved = json.loads(row["challenge"])
            saved["shard"] = Manifest(**saved["shard"])
            challenge = Challenge(**saved)
            participant = self._participant(db, participant_id)
            consent = Consent(**json.loads(participant["consent"]))
            now = self._now()
            status = None
            if (not consent.storage or consent.is_paused(now)
                    or participant["revision"] != challenge.consent_revision):
                status = "consent-changed-or-paused"
            elif not challenge.issued_at <= now < challenge.expires_at:
                status = "challenge-outside-window"
            elif (type(proof.response_sha256) is not str
                  or re.fullmatch(r"[0-9a-f]{64}", proof.response_sha256) is None
                  or not hmac.compare_digest(
                      proof.response_sha256, storage_response(challenge, _payload(challenge.shard)))):
                status = "invalid-proof"
            db.execute("UPDATE challenges SET state=? WHERE id=?",
                       ("rejected" if status else "verified", proof.challenge_id))
            if status:
                return Receipt(status)
            if participant["age_band"] != "adult" or not consent.rewards:
                return Receipt("verified-without-reward", verified=True)
            window = challenge.issued_at // DAY * DAY
            existing = db.execute(
                "SELECT 1 FROM credits WHERE participant_id=? AND shard_digest=? AND window_start=?",
                (participant_id, challenge.shard.sha256, window),
            ).fetchone()
            if existing:
                return Receipt("verified-already-rewarded", verified=True)
            total = db.execute(
                "SELECT COALESCE(SUM(units), 0) FROM credits WHERE participant_id=? AND window_start=?",
                (participant_id, window),
            ).fetchone()[0]
            remaining = SPEC["reward"]["max_units_per_participant_per_utc_day"] - total
            if remaining <= 0:
                return Receipt("verified-reward-cap-reached", verified=True)
            quantum = SPEC["reward"]["bytes_per_simulated_unit"]
            work_units = (challenge.shard.byte_length + quantum - 1) // quantum
            amount = min(work_units, remaining)
            db.execute("INSERT INTO credits VALUES (?, ?, ?, ?, ?)",
                       (participant_id, challenge.shard.sha256, window, proof.challenge_id, amount))
            status = "verified-and-credited" if amount == work_units else "verified-and-credited-capped"
            return Receipt(status, verified=True, credited_units=amount)

    def balance(self, participant_id: str) -> int:
        with self._connection() as db:
            self._participant(db, participant_id)
            return db.execute("SELECT COALESCE(SUM(units), 0) FROM credits WHERE participant_id=?",
                              (participant_id,)).fetchone()[0]


def run_demo(*, enabled: bool = False) -> dict:
    _enabled(enabled)
    with tempfile.TemporaryDirectory(prefix="calorie-participation-synthetic-") as directory:
        root = Path(directory)
        # A fixed synthetic clock keeps the demonstration reproducible even at
        # a real UTC-day boundary. Expiry/day rollover have separate tests.
        demo_time = 10 * DAY + 3600
        coordinator = Coordinator(root / "coordinator.sqlite3", enabled=True,
                                  clock=lambda: demo_time)
        consent = Consent(storage=True, rewards=True)
        coordinator.register("sim-adult", age_band="adult")
        coordinator.set_consent("sim-adult", consent)
        node = VolunteerNode(root / "node", enabled=True, consent=consent,
                             clock=lambda: demo_time)
        challenge = coordinator.issue("sim-adult", "apple")
        node.store(challenge.shard, FIXTURES["apple"])
        proof = node.prove(challenge, now=coordinator._now())
        accepted = coordinator.verify("sim-adult", proof)
        replay = coordinator.verify("sim-adult", proof)
        duplicate = coordinator.issue("sim-adult", "apple")
        duplicate_receipt = coordinator.verify(
            "sim-adult", node.prove(duplicate, now=coordinator._now()))
        pause_end = demo_time + 60
        node.pause(until=pause_end)
        coordinator.pause("sim-adult", until=pause_end)
        try:
            node.prove(duplicate, now=demo_time)
            paused_locally = False
        except SimulationError as error:
            paused_locally = str(error) == "storage-not-consented-or-paused"
        demo_time = pause_end
        resumed = coordinator.issue("sim-adult", "apple")
        resumed_receipt = coordinator.verify(
            "sim-adult", node.prove(resumed, now=demo_time))
        changed = coordinator.issue("sim-adult", "apple")
        changed_proof = node.prove(changed, now=coordinator._now())
        coordinator.stop("sim-adult")
        node.stop()
        withdrawn = coordinator.verify("sim-adult", changed_proof)
        coordinator.register("sim-larger-work", age_band="adult")
        coordinator.set_consent("sim-larger-work", consent)
        larger_node = VolunteerNode(root / "larger-node", enabled=True, consent=consent,
                                    clock=lambda: demo_time)
        larger = coordinator.issue("sim-larger-work", "vegetable-catalog")
        larger_node.store(larger.shard, FIXTURES["vegetable-catalog"])
        larger_receipt = coordinator.verify(
            "sim-larger-work", larger_node.prove(larger, now=demo_time))
        larger_node.stop()
        coordinator.stop("sim-larger-work")
        result = {
            "schema_version": SPEC["schema_version"],
            "mode": "local-synthetic-only",
            "clock": "fixed-synthetic",
            "stored_shard_sha256": challenge.shard.sha256,
            "stored_shard_bytes": challenge.shard.byte_length,
            "accepted": asdict(accepted),
            "replay": asdict(replay),
            "duplicate_work": asdict(duplicate_receipt),
            "temporary_pause_blocked_local_work": paused_locally,
            "fresh_work_after_selected_pause_end": asdict(resumed_receipt),
            "withdrawn_consent": asdict(withdrawn),
            "balance": coordinator.balance("sim-adult"),
            "unit": SPEC["reward"]["unit"],
            "reward_asset": "CALT",
            "larger_verified_work": asdict(larger_receipt),
            "larger_shard_bytes": larger.shard.byte_length,
            "local_shard_removed": node._stored_bytes() == 0,
            "onchain_transactions": 0,
        }
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--enable-synthetic-demo", action="store_true",
                        help="Explicitly run the temporary, offline fixture demonstration.")
    args = parser.parse_args()
    if not args.enable_synthetic_demo:
        print(json.dumps({"status": "disabled", "mode": "local-synthetic-only"}))
        return 2
    print(json.dumps(run_demo(enabled=True), indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
