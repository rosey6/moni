from pathlib import Path
import sys
"""Local password-reset and persistent-notification checks.

Requires the PHP server with MONI_SMTP_* configured for the local Mailpit
container and, for the expired-token assertion, Docker plus the validation DB.
"""
import json
import os
import ssl
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from http.cookiejar import CookieJar

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation_guard import require_isolated_validation_pool


BASE = os.environ.get("MONI_TEST_BASE", "http://127.0.0.1:8080")
ORIGIN = os.environ.get("MONI_TEST_ORIGIN", "http://127.0.0.1:4173")
MAILPIT = os.environ.get("MONI_MAILPIT_API", "http://127.0.0.1:18025/api/v1")


class Client:
    def __init__(self):
        self.cookies = CookieJar()
        self.csrf = ""
        handlers = [urllib.request.HTTPCookieProcessor(self.cookies)]
        if BASE.startswith("https://") and os.environ.get("MONI_TEST_INSECURE_TLS") == "1":
            handlers.insert(0, urllib.request.HTTPSHandler(context=ssl._create_unverified_context()))
        self.opener = urllib.request.build_opener(*handlers)

    def request(self, path, method="GET", body=None, csrf=True):
        headers = {"Accept": "application/json", "Origin": ORIGIN}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        if csrf and method != "GET" and self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        request = urllib.request.Request(BASE + "/" + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=10) as response:
                payload = json.loads(response.read())
                status = response.status
        except urllib.error.HTTPError as error:
            payload = json.loads(error.read())
            status = error.code
        data_payload = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(data_payload, dict) and data_payload.get("csrfToken"):
            self.csrf = data_payload["csrfToken"]
        return status, payload


def check(condition, message):
    if not condition:
        raise AssertionError(message)


def mail_messages():
    with urllib.request.urlopen(MAILPIT + "/messages", timeout=10) as response:
        return json.loads(response.read()).get("messages", [])


def latest_reset_token(before_ids):
    messages = mail_messages()
    fresh = [item for item in messages if item.get("ID") not in before_ids]
    check(fresh, "Mailpit received no reset email")
    message_id = fresh[-1]["ID"]
    with urllib.request.urlopen(MAILPIT + "/message/" + message_id, timeout=10) as response:
        message = json.loads(response.read())
    text = message.get("Text", "")
    match = re.search(r"token=([0-9a-f]{64})", text)
    check(match, "reset token was not found in Mailpit message")
    return match.group(1)


def seed_expired_token(email, token):
    ssh_target = os.environ.get("MONI_MYSQL_SSH_TARGET")
    container = os.environ.get("MONI_MYSQL_CONTAINER", "moni-validation-mysql")
    database = os.environ.get("MONI_TEST_DB_NAME", os.environ.get("MONI_DB_NAME", "moni_validation"))
    password = os.environ.get("MONI_DB_ROOT_PASSWORD")
    sql = (
        "INSERT INTO password_reset_tokens (utilisateur_id, token_hash, expires_at) "
        "SELECT id, UNHEX(SHA2('" + token + "', 256)), DATE_SUB(NOW(), INTERVAL 1 MINUTE) "
        "FROM utilisateurs WHERE email='" + email + "'"
    )
    if ssh_target:
        result = subprocess.run(
            ["ssh", "-o", "BatchMode=yes", ssh_target, "sudo", "-n", "mysql", "--protocol=socket", database],
            input=sql.encode(), capture_output=True,
        )
    else:
        check(password, "MONI_DB_ROOT_PASSWORD is required")
        result = subprocess.run(["docker", "exec", "-i", container, "mysql", "-uroot", "-p" + password, database], input=sql.encode(), capture_output=True)
    check(result.returncode == 0, "expired token seed failed")


def main():
    require_isolated_validation_pool()
    suffix = uuid.uuid4().hex[:10]
    email = f"reset-{suffix}@example.test"
    missing = f"missing-{suffix}@example.test"
    old_password = "OldValidationPassword!123"
    new_password = "NewValidationPassword!456"
    primary = Client()
    secondary = Client()
    status, payload = primary.request("register.php", "POST", {"name": "Reset Validation", "email": email, "password": old_password, "currency": "XOF", "privacyAccepted": True, "privacyPolicyVersion": "test-v1"}, csrf=False)
    check(status == 201, "reset account registration")
    status, payload = secondary.request("login.php", "POST", {"email": email, "password": old_password}, csrf=False)
    check(status == 200, "second session before reset")

    existing_before = {item.get("ID") for item in mail_messages()}
    status, payload = Client().request("forgot-password.php", "POST", {"email": email}, csrf=False)
    check(status == 202 and payload["data"]["requested"] is True, "existing reset request")
    token = latest_reset_token(existing_before)
    status, payload = Client().request("forgot-password.php", "POST", {"email": missing}, csrf=False)
    check(status == 202 and payload["data"]["requested"] is True, "unknown email neutral response")

    rate_email = f"reset-rate-{suffix}@example.test"
    rate_statuses = [Client().request("forgot-password.php", "POST", {"email": rate_email}, csrf=False)[0] for _ in range(4)]
    check(rate_statuses == [202, 202, 202, 429], "reset request rate limit")

    status, payload = Client().request("reset-password.php", "POST", {"token": token, "password": new_password, "passwordConfirmation": new_password}, csrf=False)
    check(status == 200 and payload["data"]["reset"] is True, "valid reset")
    status, payload = Client().request("reset-password.php", "POST", {"token": token, "password": new_password, "passwordConfirmation": new_password}, csrf=False)
    check(status == 400 and payload["error"]["code"] == "RESET_TOKEN_INVALID", "single use reset token")
    status, payload = primary.request("dashboard.php")
    check(status == 401, "primary session revoked")
    status, payload = secondary.request("dashboard.php")
    check(status == 401, "secondary session revoked")
    status, payload = Client().request("login.php", "POST", {"email": email, "password": old_password}, csrf=False)
    check(status == 401, "old password rejected")
    fresh = Client()
    status, payload = fresh.request("login.php", "POST", {"email": email, "password": new_password}, csrf=False)
    check(status == 200, "new password accepted")

    expired_token = uuid.uuid4().hex + uuid.uuid4().hex
    seed_expired_token(email, expired_token)
    status, payload = Client().request("reset-password.php", "POST", {"token": expired_token, "password": old_password}, csrf=False)
    check(status == 400 and payload["error"]["code"] == "RESET_TOKEN_INVALID", "expired reset token")

    status, payload = fresh.request("notifications.php", "POST", {"notifications": [{"id": "validation:notice", "text": "Validation notice"}]})
    check(status == 200 and payload["data"]["notifications"][0]["read"] is False, "notification sync")
    status, payload = fresh.request("notifications.php", "PATCH", {"id": "validation:notice"})
    check(status == 200 and payload["data"]["notifications"][0]["read"] is True, "notification read persistence")
    fresh.request("logout.php", "POST", {})
    reconnected = Client()
    status, payload = reconnected.request("login.php", "POST", {"email": email, "password": new_password}, csrf=False)
    check(status == 200, "reconnect after reset")
    status, payload = reconnected.request("notifications.php")
    item = next(item for item in payload["data"]["notifications"] if item["id"] == "validation:notice")
    check(status == 200 and item["read"] is True, "notification state after reconnect")
    print("Password reset validation passed: SMTP delivery, neutral lookup, token expiry, single use, session revocation, rate limit, notifications")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Password reset validation failed: {error}", file=sys.stderr)
        raise
