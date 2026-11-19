from pathlib import Path
import sys
"""Integration checks for notifications against a deliberately isolated MySQL pool."""
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from http.cookiejar import CookieJar

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation_guard import require_isolated_validation_pool


BASE = os.environ.get("MONI_TEST_BASE", "http://127.0.0.1:8080")


class Client:
    def __init__(self):
        self.cookies = CookieJar()
        self.csrf = ""
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.cookies))

    def request(self, path, method="GET", body=None, csrf=True):
        headers = {"Accept": "application/json"}
        data = None
        if body is not None:
            headers["Content-Type"] = "application/json"
            data = json.dumps(body).encode()
        if csrf and method != "GET" and self.csrf:
            headers["X-CSRF-Token"] = self.csrf
        request = urllib.request.Request(f"{BASE}/{path}", data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=15) as response:
                status, payload = response.status, json.loads(response.read())
        except urllib.error.HTTPError as error:
            status, payload = error.code, json.loads(error.read())
        data_payload = payload.get("data") if isinstance(payload, dict) else None
        if isinstance(data_payload, dict) and data_payload.get("csrfToken"):
            self.csrf = data_payload["csrfToken"]
        return status, payload


def check(condition, description):
    if not condition:
        raise AssertionError(description)


def register(client, label, suffix):
    email = f"notify-{label.lower()}-{suffix}@example.test"
    status, payload = client.request("register.php", "POST", {
        "name": label,
        "email": email,
        "password": "ValidationPassword!123",
        "currency": "XOF",
        "privacyAccepted": True, "privacyPolicyVersion": "test-v1",
    }, csrf=False)
    check(status == 201 and payload.get("success"), f"register {label}")
    return email


def main():
    require_isolated_validation_pool()
    check(os.environ["MONI_TEST_DB_NAME"].lower() not in {"moni", "moni_validation"}, "test DB must not be the standard app database")
    suffix = uuid.uuid4().hex[:10]
    a, b = Client(), Client()
    email_a = register(a, "A", suffix)
    register(b, "B", suffix)

    status, unauth = Client().request("notifications.php")
    check(status == 401 and unauth["error"]["code"] == "AUTH_REQUIRED", "unauthenticated read")
    status, rejected = a.request("notifications.php", "POST", {"notifications": [{"id": "csrf", "text": "csrf"}]}, csrf=False)
    check(status == 403 and rejected["error"]["code"] == "CSRF_INVALID", "write requires CSRF")

    items = [{"id": f"notice-{i:03d}", "text": f"Notification {i}"} for i in range(105)]
    items[-1].update({"type": "security", "title": "Fake security event", "destination": "profile", "resourceId": 1})
    for start in range(0, len(items), 100):
        status, written = a.request("notifications.php", "POST", {"notifications": items[start:start + 100]})
        check(status == 200 and written.get("success"), "persist notifications")

    status, first = a.request("notifications.php?limit=40")
    page = first["data"]
    check(status == 200 and len(page["notifications"]) == 40, f"first page size: status={status}, count={len(page.get('notifications', []))}, payload={first}")
    check(page["unreadCount"] == 105 and page["nextCursor"], "exact unread count and cursor")
    untrusted = next(row for row in page["notifications"] if row["id"] == "notice-104")
    check(untrusted["type"] is None and untrusted["title"] is None and untrusted["destination"] is None and untrusted["resourceId"] is None, "client metadata cannot create trusted notification events")
    check(all(row["createdAt"].endswith("Z") for row in page["notifications"]), "UTC timestamps")
    seen = {row["id"] for row in page["notifications"]}
    cursor = page["nextCursor"]
    pages = 1
    while cursor:
        status, response = a.request(f"notifications.php?limit=40&cursor={cursor}")
        check(status == 200, "cursor page response")
        page = response["data"]
        current = {row["id"] for row in page["notifications"]}
        check(not current.intersection(seen), "pagination has no duplicate rows")
        seen |= current
        cursor = page["nextCursor"]
        pages += 1
        check(pages < 5, "pagination terminates")
    check(len(seen) == 105 and pages == 3, "all rows reached in stable pages")

    reconnected = Client()
    status, logged_in = reconnected.request("login.php", "POST", {"email": email_a, "password": "ValidationPassword!123"}, csrf=False)
    check(status == 200 and logged_in.get("success"), "reconnect account")
    status, persisted = reconnected.request("notifications.php?limit=100")
    check(status == 200 and persisted["data"]["unreadCount"] == 105 and len(persisted["data"]["notifications"]) == 100, "notification persistence after reconnect")

    status, invalid = a.request("notifications.php?limit=0")
    check(status == 422 and invalid["error"]["code"] == "INVALID_LIMIT", "invalid limit rejected")
    status, invalid = a.request("notifications.php?cursor=not-a-valid-json-cursor")
    check(status == 422 and invalid["error"]["code"] == "INVALID_CURSOR", "invalid cursor rejected")

    target = "notice-050"
    status, marked = reconnected.request("notifications.php", "PATCH", {"id": target})
    check(status == 200 and marked.get("success"), "individual read")
    status, repeated = reconnected.request("notifications.php", "PATCH", {"id": target})
    check(status == 200 and repeated.get("success"), "individual read is idempotent")
    status, unread = reconnected.request("notifications.php?filter=unread&limit=100")
    check(status == 200 and unread["data"]["unreadCount"] == 104, "unread filter and count")
    check(all(row["id"] != target and not row["read"] for row in unread["data"]["notifications"]), "unread filter excludes read item")

    status, isolated = b.request("notifications.php")
    check(status == 200 and isolated["data"]["notifications"] == [] and isolated["data"]["unreadCount"] == 0, "account isolation")
    status, forbidden = b.request("notifications.php", "PATCH", {"id": "notice-050"})
    check(status == 404, "cross-account notification IDOR")
    status, all_read = reconnected.request("notifications.php", "PATCH", {"action": "read_all"})
    check(status == 200 and all_read.get("success"), "mark all read")
    status, final = reconnected.request("notifications.php?filter=unread")
    check(status == 200 and final["data"]["unreadCount"] == 0 and final["data"]["notifications"] == [], "unread count reaches zero")

    print("NOTIFICATIONS_ISOLATED_API_PASS: auth, CSRF, persistence, UTC, cursor pagination, filters, idempotent read, bulk read, IDOR")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Isolated notification API validation failed: {error}", file=sys.stderr)
        raise
