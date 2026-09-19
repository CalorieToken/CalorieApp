"""Fixed synthetic compute worker.

Reads one canonical JSON object from stdin and writes one canonical JSON object.
This module intentionally accepts no code, command, path, URL, database, wallet,
secret or network parameter. It is only a child process used by the local
participation simulator.
"""
from __future__ import annotations

import json
import sys


def canonical(value: object) -> str:
    return json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=True, allow_nan=False
    )


def summarize(payload: dict) -> dict:
    if type(payload) is not dict or set(payload) != {"schema_version", "synthetic", "records"}:
        raise ValueError("invalid-input")
    if payload["schema_version"] != "caloriedb.synthetic-public-shard.v1":
        raise ValueError("invalid-input")
    if payload["synthetic"] is not True or type(payload["records"]) is not list:
        raise ValueError("invalid-input")

    labels: list[str] = []
    ids: list[str] = []
    for record in payload["records"]:
        if type(record) is not dict or set(record) != {"id", "label"}:
            raise ValueError("invalid-record")
        record_id = record["id"]
        label = record["label"]
        if type(record_id) is not str or type(label) is not str:
            raise ValueError("invalid-record")
        if len(record_id) > 80 or len(label) > 120:
            raise ValueError("invalid-record")
        ids.append(record_id)
        labels.append(label)

    return {
        "schema_version": "caloriedb.synthetic-compute-result.v1",
        "record_count": len(ids),
        "ids_sorted": sorted(ids),
        "label_initials_sorted": sorted(label[:1].lower() for label in labels),
    }


def main() -> int:
    try:
        payload = json.load(sys.stdin)
        sys.stdout.write(canonical(summarize(payload)) + "\n")
        return 0
    except (ValueError, TypeError, json.JSONDecodeError):
        sys.stdout.write(canonical({"status": "invalid-input"}) + "\n")
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
