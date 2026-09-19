"""Bounded deterministic compute slice for the local participation simulator.

This is not a general-purpose remote execution service. Only embedded synthetic
public fixtures are accepted and the worker is fixed repository code.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
import hashlib
import hmac
import json
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import time
from typing import Callable

from tools.participation_simulator import Consent, FIXTURES, SPEC, SimulationError, canonical


ROOT = Path(__file__).resolve().parents[1]
COMPUTE = SPEC["compute"]
DAY = 86400


def _digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


@dataclass(frozen=True)
class ComputeTask:
    schema_version: str
    task_type: str
    task_id: str
    participant_id: str
    fixture: str
    input_sha256: str
    input_bytes: int
    issued_at: int
    expires_at: int
    consent_revision: int


@dataclass(frozen=True)
class ComputeProof:
    task_id: str
    output: dict
    output_sha256: str


@dataclass(frozen=True)
class ComputeReceipt:
    status: str
    verified: bool = False
    credited_units: int = 0
    unit: str = "CALT_SIMULATED"


def _payload(name: str) -> bytes:
    if name not in FIXTURES:
        raise SimulationError("synthetic-fixture-required")
    value = FIXTURES[name]
    if len(value) > COMPUTE["max_input_bytes"]:
        raise SimulationError("compute-input-budget-exceeded")
    parsed = json.loads(value)
    if len(parsed["records"]) > COMPUTE["max_records_per_task"]:
        raise SimulationError("compute-record-budget-exceeded")
    return value


def _run_fixed_worker(payload: bytes) -> dict:
    try:
        result = subprocess.run(
            [sys.executable, "-I", str(ROOT / "tools" / "participation_compute_worker.py")],
            input=payload,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            cwd=ROOT,
            timeout=COMPUTE["worker_timeout_seconds"],
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise SimulationError("compute-time-budget-exceeded") from exc
    if result.returncode != 0:
        raise SimulationError("compute-worker-rejected-input")
    if len(result.stdout) > COMPUTE["max_output_bytes"]:
        raise SimulationError("compute-output-budget-exceeded")
    try:
        output = json.loads(result.stdout)
    except json.JSONDecodeError as exc:
        raise SimulationError("compute-output-invalid") from exc
    if type(output) is not dict:
        raise SimulationError("compute-output-invalid")
    return output


class ComputeNode:
    """One opted-in local helper; no arbitrary command or input admission."""

    def __init__(self, *, enabled: bool = False, consent: Consent = Consent(),
                 clock: Callable[[], float] = time.time) -> None:
        if enabled is not True:
            raise SimulationError("simulation-disabled")
        self.consent = consent
        self.clock = clock
        self.completed_tasks = 0

    def execute(self, task: ComputeTask, *, now: int) -> ComputeProof:
        if not self.consent.compute or self.consent.is_paused(now):
            raise SimulationError("compute-not-consented-or-paused")
        if self.completed_tasks >= COMPUTE["max_tasks_per_node_run"]:
            raise SimulationError("compute-task-budget-exceeded")
        if task.task_type != COMPUTE["task_type"]:
            raise SimulationError("unsupported-compute-task")
        if not task.issued_at <= now < task.expires_at:
            raise SimulationError("compute-task-outside-window")
        payload = _payload(task.fixture)
        if task.input_sha256 != _digest(payload) or task.input_bytes != len(payload):
            raise SimulationError("compute-input-integrity-failed")
        output = _run_fixed_worker(payload)
        encoded = canonical(output)
        if len(encoded) > COMPUTE["max_output_bytes"]:
            raise SimulationError("compute-output-budget-exceeded")
        self.completed_tasks += 1
        return ComputeProof(task.task_id, output, _digest(encoded))


class ComputeCoordinator:
    """Separate synthetic compute ledger with independent central recomputation."""

    def __init__(self, database: Path, *, enabled: bool = False,
                 clock: Callable[[], float] = time.time) -> None:
        if enabled is not True:
            raise SimulationError("simulation-disabled")
        self.database = database
        self.clock = clock
        import sqlite3
        with sqlite3.connect(database) as db:
            db.executescript("""
                CREATE TABLE IF NOT EXISTS participants (
                    id TEXT PRIMARY KEY, age_band TEXT NOT NULL,
                    consent TEXT NOT NULL, revision INTEGER NOT NULL);
                CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY, participant_id TEXT NOT NULL,
                    task TEXT NOT NULL, state TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS credits (
                    participant_id TEXT NOT NULL, input_digest TEXT NOT NULL,
                    window_start INTEGER NOT NULL, task_id TEXT NOT NULL UNIQUE,
                    units INTEGER NOT NULL CHECK(units > 0),
                    PRIMARY KEY(participant_id, input_digest, window_start));
            """)

    def _connect(self):
        import sqlite3
        db = sqlite3.connect(self.database, isolation_level=None, timeout=10)
        db.row_factory = sqlite3.Row
        return db

    def register(self, participant_id: str, *, age_band: str) -> None:
        if re.fullmatch(r"sim-[a-z0-9-]{1,40}", participant_id) is None:
            raise SimulationError("synthetic-identity-required")
        if age_band not in ("child", "teen", "adult"):
            raise SimulationError("invalid-age-band")
        db = self._connect()
        try:
            db.execute("INSERT INTO participants VALUES (?, ?, ?, 0)", (
                participant_id, age_band, canonical(asdict(Consent())).decode("ascii")))
        finally:
            db.close()

    def set_consent(self, participant_id: str, consent: Consent) -> None:
        if not isinstance(consent, Consent):
            raise SimulationError("invalid-consent")
        db = self._connect()
        try:
            row = db.execute("SELECT 1 FROM participants WHERE id=?", (participant_id,)).fetchone()
            if row is None:
                raise SimulationError("unknown-participant")
            db.execute("UPDATE participants SET consent=?, revision=revision+1 WHERE id=?", (
                canonical(asdict(consent)).decode("ascii"), participant_id))
        finally:
            db.close()

    def issue(self, participant_id: str, fixture: str) -> ComputeTask:
        import secrets
        payload = _payload(fixture)
        now = int(self.clock())
        db = self._connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM participants WHERE id=?", (participant_id,)).fetchone()
            if row is None:
                raise SimulationError("unknown-participant")
            consent = Consent(**json.loads(row["consent"]))
            if not consent.compute or consent.is_paused(now):
                raise SimulationError("compute-not-consented-or-paused")
            expires = min(now + SPEC["challenge_ttl_seconds"], (now // DAY + 1) * DAY)
            task = ComputeTask(
                SPEC["schema_version"], COMPUTE["task_type"], "sim-" + secrets.token_hex(16),
                participant_id, fixture, _digest(payload), len(payload), now, expires, row["revision"])
            db.execute("INSERT INTO tasks VALUES (?, ?, ?, 'pending')", (
                task.task_id, participant_id, canonical(asdict(task)).decode("ascii")))
            db.execute("COMMIT")
            return task
        except BaseException:
            if db.in_transaction:
                db.execute("ROLLBACK")
            raise
        finally:
            db.close()

    def verify(self, participant_id: str, proof: ComputeProof) -> ComputeReceipt:
        db = self._connect()
        try:
            db.execute("BEGIN IMMEDIATE")
            row = db.execute("SELECT * FROM tasks WHERE id=?", (proof.task_id,)).fetchone()
            if row is None or row["participant_id"] != participant_id:
                db.execute("ROLLBACK")
                return ComputeReceipt("unknown-task-or-owner")
            if row["state"] != "pending":
                db.execute("ROLLBACK")
                return ComputeReceipt("already-consumed")
            task = ComputeTask(**json.loads(row["task"]))
            participant = db.execute(
                "SELECT * FROM participants WHERE id=?", (participant_id,)).fetchone()
            consent = Consent(**json.loads(participant["consent"]))
            now = int(self.clock())
            status = None
            if (not consent.compute or consent.is_paused(now)
                    or participant["revision"] != task.consent_revision):
                status = "consent-changed-or-paused"
            elif not task.issued_at <= now < task.expires_at:
                status = "compute-task-outside-window"
            else:
                expected = _run_fixed_worker(_payload(task.fixture))
                encoded = canonical(proof.output)
                if (len(encoded) > COMPUTE["max_output_bytes"]
                        or not hmac.compare_digest(proof.output_sha256, _digest(encoded))
                        or proof.output != expected):
                    status = "invalid-compute-result"
            db.execute("UPDATE tasks SET state=? WHERE id=?", (
                "rejected" if status else "verified", proof.task_id))
            if status:
                db.execute("COMMIT")
                return ComputeReceipt(status)
            if participant["age_band"] != "adult" or not consent.rewards:
                db.execute("COMMIT")
                return ComputeReceipt("verified-without-reward", verified=True)

            window = task.issued_at // DAY * DAY
            duplicate = db.execute(
                "SELECT 1 FROM credits WHERE participant_id=? AND input_digest=? AND window_start=?",
                (participant_id, task.input_sha256, window)).fetchone()
            if duplicate:
                db.execute("COMMIT")
                return ComputeReceipt("verified-already-rewarded", verified=True)
            total = db.execute(
                "SELECT COALESCE(SUM(units),0) FROM credits WHERE participant_id=? AND window_start=?",
                (participant_id, window)).fetchone()[0]
            remaining = SPEC["reward"]["max_units_per_participant_per_utc_day"] - total
            if remaining <= 0:
                db.execute("COMMIT")
                return ComputeReceipt("verified-reward-cap-reached", verified=True)
            record_count = len(json.loads(_payload(task.fixture))["records"])
            quantum = COMPUTE["records_per_simulated_unit"]
            work_units = max(1, (record_count + quantum - 1) // quantum)
            amount = min(work_units, remaining)
            db.execute("INSERT INTO credits VALUES (?, ?, ?, ?, ?)", (
                participant_id, task.input_sha256, window, task.task_id, amount))
            db.execute("COMMIT")
            return ComputeReceipt(
                "verified-and-credited" if amount == work_units else "verified-and-credited-capped",
                verified=True, credited_units=amount)
        except BaseException:
            if db.in_transaction:
                db.execute("ROLLBACK")
            raise
        finally:
            db.close()

    def balance(self, participant_id: str) -> int:
        db = self._connect()
        try:
            return db.execute(
                "SELECT COALESCE(SUM(units),0) FROM credits WHERE participant_id=?",
                (participant_id,)).fetchone()[0]
        finally:
            db.close()


def run_compute_demo(*, enabled: bool = False) -> dict:
    if enabled is not True:
        raise SimulationError("simulation-disabled")
    now = 12 * DAY + 3600
    clock = lambda: now
    with tempfile.TemporaryDirectory(prefix="calorie-compute-synthetic-") as directory:
        coordinator = ComputeCoordinator(Path(directory) / "compute.sqlite", enabled=True, clock=clock)
        consent = Consent(compute=True, rewards=True)
        coordinator.register("sim-compute", age_band="adult")
        coordinator.set_consent("sim-compute", consent)
        node = ComputeNode(enabled=True, consent=consent, clock=clock)
        task = coordinator.issue("sim-compute", "vegetable-catalog")
        proof = node.execute(task, now=now)
        receipt = coordinator.verify("sim-compute", proof)
        return {
            "mode": "local-synthetic-compute-only",
            "task_type": COMPUTE["task_type"],
            "verified": receipt.verified,
            "credited_units": receipt.credited_units,
            "unit": receipt.unit,
            "balance": coordinator.balance("sim-compute"),
            "onchain_transactions": 0,
            "arbitrary_code_execution": False,
            "secure_general_purpose_sandbox": COMPUTE["secure_general_purpose_sandbox"],
        }


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--enable-synthetic-demo", action="store_true")
    args = parser.parse_args()
    if not args.enable_synthetic_demo:
        print(json.dumps({"mode": "local-synthetic-compute-only", "status": "disabled"}))
        raise SystemExit(2)
    print(json.dumps(run_compute_demo(enabled=True), sort_keys=True))
