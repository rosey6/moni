from pathlib import Path
import sys
"""End-to-end API checks for a local Moni validation database.

Run with the PHP server configured for the isolated validation database:
    python backend/tests/integration/http_validation.py
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
import uuid
from http.cookiejar import CookieJar

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation_guard import require_isolated_validation_pool


BASE = os.environ.get("MONI_TEST_BASE", "http://127.0.0.1:8080")
ORIGIN = os.environ.get("MONI_TEST_ORIGIN", "http://127.0.0.1:4173")


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


def main():
    require_isolated_validation_pool()
    suffix = uuid.uuid4().hex[:10]
    email_a = f"validation-a-{suffix}@example.test"
    email_b = f"validation-b-{suffix}@example.test"
    password = "ValidationPassword!123"
    a, b = Client(), Client()

    status, payload = Client().request("dashboard.php")
    check(status == 401 and payload["error"]["code"] == "AUTH_REQUIRED", "unauthenticated dashboard access")
    status, payload = Client().request("budgets.php")
    check(status == 401 and payload["error"]["code"] == "AUTH_REQUIRED", "unauthenticated budget access")

    status, rejected = Client().request("register.php", "POST", {"name": "No Consent", "email": email_a, "password": password, "currency": "XOF"}, csrf=False)
    check(status == 422 and rejected["error"]["code"] == "PRIVACY_CONSENT_REQUIRED", "backend rejects missing consent")
    status, rejected = Client().request("register.php", "POST", {"name": "Old Policy", "email": email_a, "password": password, "currency": "XOF", "privacyAccepted": True, "privacyPolicyVersion": "old-version"}, csrf=False)
    check(status == 409 and rejected["error"]["code"] == "PRIVACY_POLICY_CHANGED", "backend rejects stale policy version")
    status, public_policy = Client().request("privacy-policy.php?format=json", csrf=False)
    check(status == 200 and public_policy["data"]["version"] == "test-v1", "public policy endpoint requires no auth")
    status, payload = a.request("register.php", "POST", {"name": "Validation A", "email": email_a, "password": password, "currency": "XOF", "privacyAccepted": True, "privacyPolicyVersion": "test-v1"}, csrf=False)
    check(payload["data"]["privacyConsent"]["version"] == "test-v1" and payload["data"]["privacyConsent"]["acceptedAt"], "recorded consent version and timestamp")
    check(status == 201 and payload["success"], "register A")
    status, duplicate = Client().request("register.php", "POST", {"name": "Duplicate", "email": email_a, "password": password, "privacyAccepted": True, "privacyPolicyVersion": "test-v1"}, csrf=False)
    check(status == 409 and duplicate["error"]["code"] == "EMAIL_EXISTS", "duplicate email")

    onboarding = {
        "currency": "XOF",
        "budget": 250000,
        "allocations": {"rent": 100000, "groceries": 50000, "transport": 0, "unexpected": 0},
        "subscriptions": [{"name": "Validation Music", "amount": 3000, "billingDay": 15, "includedIn": None}],
    }
    status, payload = a.request("onboarding.php", "PUT", onboarding)
    state = payload["data"]["state"]
    check(status == 200 and state["budget"] == 250000 and state["subscriptions"][0]["name"] == "Validation Music", "onboarding")
    check(state["availableBalance"] == 0 and state["savingsAffectAvailableBalance"] is False, "subscription schedule does not change available balance")

    status, budgets = a.request("budgets.php")
    check(status == 200 and len(budgets["data"]["budgets"]) == 2, "budget read")
    budget_id = budgets["data"]["budgets"][0]["id"]
    status, payload = a.request("budgets.php", "PATCH", {"id": budget_id, "category": "rent", "limit": 110000, "month": 11, "year": 2026})
    check(status == 200 and payload["data"]["state"]["allocations"]["rent"] == 110000, "budget update")
    status, subscriptions = a.request("subscriptions.php")
    check(status == 200 and len(subscriptions["data"]["subscriptions"]) == 1, "subscription read")
    subscription_id = subscriptions["data"]["subscriptions"][0]["id"]
    status, payload = a.request("subscriptions.php", "PATCH", {"id": subscription_id, "name": "Validation Music Updated", "amount": 3500, "billingDay": 16, "includedIn": None})
    check(status == 200 and payload["data"]["state"]["subscriptions"][0]["name"] == "Validation Music Updated", "subscription update")
    status, payload = a.request("transactions.php", "POST", {"type": "expense", "amount": 12500, "category": "groceries", "date": "2026-11-07", "description": "'); DROP TABLE transactions; --"})
    check(status == 201, "transaction create")
    transaction_id = payload["data"]["state"]["transactions"][0]["id"]
    status, payload = a.request("transactions.php", "PATCH", {"id": transaction_id, "type": "expense", "amount": 13000, "category": "groceries", "date": "2026-11-07", "description": "updated"})
    check(status == 200 and payload["data"]["state"]["transactions"][0]["amount"] == 13000, "transaction update")
    status, payload = a.request("transactions.php", "POST", {"type": "income", "amount": 20000, "category": "salary", "date": "2026-11-08", "description": "recorded income"})
    check(status == 201 and payload["data"]["state"]["availableBalance"] == 7000, "available balance uses recorded income and expense")
    for category in ("scholarship", "family_support", "freelance", "other_income"):
        status, payload = a.request("transactions.php", "POST", {"type": "income", "amount": 1, "category": category, "date": "2026-11-08", "description": "category validation"})
        check(status == 201, f"income category {category}")
    check(payload["data"]["state"]["availableBalance"] == 7004, "all five income categories affect recorded balance")
    status, payload = a.request("transactions.php", "POST", {"type": "expense", "amount": 1, "category": "salary", "date": "2026-11-08"})
    check(status == 422 and payload["error"]["code"] == "INVALID_CATEGORY", "income category rejected for expense")
    status, payload = a.request("transactions.php", "POST", {"type": "income", "amount": 1, "category": "rent", "date": "2026-11-08"})
    check(status == 422 and payload["error"]["code"] == "INVALID_CATEGORY", "expense category rejected for income")
    status, payload = a.request("profile.php", "PATCH", {"currency": "EUR"})
    check(status == 409 and payload["error"]["code"] == "CURRENCY_CHANGE_REQUIRES_MIGRATION", "currency change with financial data is refused")
    status, payload = a.request("savings.php", "POST", {"name": "Validation Goal", "target": 100000, "date": "2030-12-31", "initial": 10000})
    check(status == 201 and payload["data"]["state"]["availableBalance"] == 7004, "goal creation does not double count savings")
    goal_id = next(goal["id"] for goal in payload["data"]["state"]["goals"] if goal["name"] == "Validation Goal")
    status, payload = a.request("savings.php", "POST", {"contribution": True, "goalId": goal_id, "amount": 5000})
    check(status == 201 and payload["data"]["state"]["availableBalance"] == 7004, "contribution is tracked separately from available balance")
    contribution_id = next(goal for goal in payload["data"]["state"]["goals"] if goal["id"] == goal_id)["contributions"][0]["id"]
    status, payload = a.request("savings.php", "PATCH", {"contribution": True, "goalId": goal_id, "id": contribution_id, "amount": 6000})
    check(status == 200, "contribution update")
    status, payload = a.request("savings.php", "PATCH", {"id": goal_id, "name": "Validation Goal Updated", "target": 120000, "date": "2030-12-31"})
    check(status == 200 and payload["data"]["state"]["goals"][0]["name"] == "Validation Goal Updated", "goal update")
    status, payload = a.request("savings.php", "POST", {"name": "Goal without date", "target": 100000, "date": None})
    check(status == 201 and any(goal["name"] == "Goal without date" and goal["date"] is None for goal in payload["data"]["state"]["goals"]), "optional goal date")
    status, payload = a.request("profile.php", "PATCH", {"name": "Validation A Updated"})
    check(status == 200 and payload["data"]["state"]["profile"]["name"] == "Validation A Updated", "profile update")

    csrf_token = a.csrf
    status, payload = a.request("transactions.php", "POST", {"type": "expense", "amount": 1, "category": "groceries", "date": "2026-11-07", "description": "missing csrf"}, csrf=False)
    check(status == 403 and payload["error"]["code"] == "CSRF_INVALID", "missing csrf")
    a.csrf = "invalid-csrf-token"
    status, payload = a.request("transactions.php", "POST", {"type": "expense", "amount": 1, "category": "groceries", "date": "2026-11-07"})
    check(status == 403 and payload["error"]["code"] == "CSRF_INVALID", "invalid csrf")
    a.csrf = csrf_token
    status, payload = a.request("transactions.php", "POST", {"type": "expense", "amount": 1.2, "category": "groceries", "date": "2026-11-07"})
    check(status == 422 and payload["error"]["code"] == "INVALID_AMOUNT", "fractional amount")
    status, payload = a.request("profile.php", "PATCH", {"currency": "NOT"})
    check(status == 422 and payload["error"]["code"] == "INVALID_CURRENCY", "invalid currency")

    status, payload = b.request("register.php", "POST", {"name": "Validation B", "email": email_b, "password": password, "currency": "XOF", "privacyAccepted": True, "privacyPolicyVersion": "test-v1"}, csrf=False)
    check(status == 201, "register B")
    status, payload = b.request("profile.php", "PATCH", {"currency": "EUR"})
    check(status == 200 and payload["data"]["state"]["currency"] == "EUR", "currency change before financial data")
    status, payload = b.request("dashboard.php")
    state_b = payload["data"]["state"]
    check(status == 200 and state_b["transactions"] == [] and state_b["goals"] == [], "tenant isolation read")
    status, payload = b.request("transactions.php", "PATCH", {"id": transaction_id, "type": "expense", "amount": 1, "category": "groceries", "date": "2026-11-07"})
    check(status == 404, "tenant isolation transaction update")
    status, payload = b.request("transactions.php", "DELETE", {"id": transaction_id})
    check(status == 404, "tenant isolation transaction delete")
    status, payload = b.request("budgets.php", "DELETE", {"id": budget_id})
    check(status == 404, "tenant isolation budget delete")
    status, payload = b.request("subscriptions.php", "DELETE", {"id": subscription_id})
    check(status == 404, "tenant isolation subscription delete")
    status, payload = b.request("savings.php", "PATCH", {"id": goal_id, "name": "hijack", "target": 100, "date": "2030-12-31"})
    check(status == 404, "tenant isolation goal update")

    status, payload = a.request("transactions.php", "DELETE", {"id": transaction_id})
    check(status == 200, "transaction delete")
    status, payload = a.request("savings.php", "DELETE", {"id": goal_id})
    check(status == 200, "goal delete")
    status, payload = a.request("subscriptions.php", "DELETE", {"id": subscription_id})
    check(status == 200, "subscription delete")

    rate_email = f"rate-{suffix}@example.test"
    results = [Client().request("login.php", "POST", {"email": rate_email, "password": "wrong"}, csrf=False)[0] for _ in range(6)]
    check(results[:5] == [401] * 5 and results[5] == 429, "login rate limit")

    status, payload = a.request("logout.php", "POST", {})
    check(status == 200, "logout A")
    status, payload = a.request("dashboard.php")
    check(status == 401, "session invalid after logout")
    status, payload = b.request("logout.php", "POST", {})
    check(status == 200, "logout B")
    print("HTTP validation passed: auth, CRUD, tenant isolation, CSRF, validation, SQLi payload, rate limit, logout")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"HTTP validation failed: {error}", file=sys.stderr)
        raise
