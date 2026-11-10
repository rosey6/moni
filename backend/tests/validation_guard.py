"""Fail closed before any validation test can write to the active database."""
import os


def require_isolated_validation_pool():
    database = os.environ.get("MONI_TEST_DB_NAME", "").strip().lower()
    expected = os.environ.get("MONI_TEST_EXPECTED_DB", "moni_validation_vps").strip().lower()
    pool = os.environ.get("MONI_TEST_POOL", "").strip().lower()
    if not expected or expected == "moni" or database != expected:
        raise RuntimeError("MONI_TEST_DB_NAME must match an isolated MONI_TEST_EXPECTED_DB, never 'moni'")
    if pool != "moni-validation":
        raise RuntimeError("MONI_TEST_POOL must be 'moni-validation'")
