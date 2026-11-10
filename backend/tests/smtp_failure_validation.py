"""Verify that SMTP delivery failure is surfaced instead of faked."""
import sys
import uuid

from password_reset_validation import Client, check
from validation_guard import require_isolated_validation_pool


def main():
    require_isolated_validation_pool()
    suffix = uuid.uuid4().hex[:10]
    email = f"smtp-failure-{suffix}@example.test"
    client = Client()
    status, payload = client.request("register.php", "POST", {"name": "SMTP Failure", "email": email, "password": "ValidationPassword!123", "currency": "XOF"}, csrf=False)
    check(status == 201, "SMTP failure fixture registration")
    status, payload = Client().request("forgot-password.php", "POST", {"email": email}, csrf=False)
    check(status == 503 and payload["error"]["code"] == "EMAIL_UNAVAILABLE", "SMTP failure response")
    check("token=" not in str(payload), "reset token leaked in SMTP error")
    print("SMTP failure validation passed: no fake success and no token in response")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"SMTP failure validation failed: {error}", file=sys.stderr)
        raise
