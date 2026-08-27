"""Regression tests for privacy-safe application logging."""

import ast
from pathlib import Path

_REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
_LOGGING_MODULES = (
    "backend/app/main.py",
    "backend/app/services/identity.py",
    "backend/app/services/open_food_facts.py",
)
_SENSITIVE_NAMES = {
    "auth_code_db",
    "client_ip",
    "code",
    "code_hash",
    "current_user",
    "entry",
    "external_identity_db",
    "external_subject",
    "log_id",
    "login_session_id",
    "query",
    "safe_query",
    "state",
    "user",
    "user_db",
}
_SENSITIVE_MESSAGE_FRAGMENTS = (
    "external_subject=",
    "hash=",
    "login_session_id=",
    "owner=",
    "product_name=",
    "query=",
    "state=",
    "user_id=",
)


def _logger_calls(tree: ast.AST):
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        function = node.func
        if (
            isinstance(function, ast.Attribute)
            and isinstance(function.value, ast.Name)
            and function.value.id == "logger"
        ):
            yield node


def test_sensitive_values_are_not_passed_to_log_calls() -> None:
    violations: list[str] = []

    for relative_path in _LOGGING_MODULES:
        source_path = _REPOSITORY_ROOT / relative_path
        tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=relative_path)

        for call in _logger_calls(tree):
            value_arguments = list(call.args[1:])
            value_arguments.extend(keyword.value for keyword in call.keywords)

            exposed_names = {
                child.id
                for argument in value_arguments
                for child in ast.walk(argument)
                if isinstance(child, ast.Name) and child.id in _SENSITIVE_NAMES
            }
            if exposed_names:
                violations.append(
                    f"{relative_path}:{call.lineno}: {sorted(exposed_names)}"
                )

    assert not violations, "Sensitive values passed to log calls: " + "; ".join(violations)


def test_log_messages_do_not_label_sensitive_fields() -> None:
    violations: list[str] = []

    for relative_path in _LOGGING_MODULES:
        source_path = _REPOSITORY_ROOT / relative_path
        tree = ast.parse(source_path.read_text(encoding="utf-8"), filename=relative_path)

        for call in _logger_calls(tree):
            if not call.args:
                continue
            message = call.args[0]
            if not isinstance(message, ast.Constant) or not isinstance(message.value, str):
                continue

            lowered = message.value.lower()
            matches = [
                fragment
                for fragment in _SENSITIVE_MESSAGE_FRAGMENTS
                if fragment in lowered
            ]
            if matches:
                violations.append(f"{relative_path}:{call.lineno}: {matches}")

    assert not violations, "Sensitive log labels found: " + "; ".join(violations)
