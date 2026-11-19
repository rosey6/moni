from pathlib import Path
"""End-to-end N4 checks using the isolated API and deterministic scheduler clock."""
import os
import subprocess
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation_guard import require_isolated_validation_pool
from notifications_isolated_validation import BASE, Client, check, register


def main():
    require_isolated_validation_pool()
    suffix = uuid.uuid4().hex[:10]
    client = Client()
    register(client, "Events", suffix)
    _, profile = client.request("me.php")
    user = profile["data"]["state"]["profile"]["id"]
    year, month = 2026, 11

    status, _ = client.request("profile.php", "PATCH", {"alerts": {"budget": False, "subscriptions": False, "savings": False}})
    check(status == 200, "global alerts preference off")
    status, _ = client.request("budgets.php", "POST", {"category": "transport", "limit": 100000, "month": month, "year": year})
    check(status == 201, "create transport budget")
    status, _ = client.request("transactions.php", "POST", {"type": "expense", "amount": 80000, "category": "transport", "date": "2026-11-13", "description": "switch-off"})
    check(status == 201, "business mutation with alerts off")
    _, response = client.request("notifications.php?limit=100")
    check(not any(row["type"] == "budget" for row in response["data"]["notifications"]), "global switch suppresses internal financial alerts")

    status, _ = client.request("profile.php", "PATCH", {"alerts": {"budget": True, "subscriptions": True, "savings": True}})
    check(status == 200, "global alerts preference on")
    atomic_env = os.environ.copy()
    atomic_env.update({"MONI_ASSERT_USER": str(user), "MONI_ASSERT_KEY": "rollback-test:" + suffix})
    atomic_php = """require 'backend/database.php'; require 'backend/lib/notification_events.php'; $pdo=moniConnect(); $u=(int)getenv('MONI_ASSERT_USER'); $key=getenv('MONI_ASSERT_KEY'); $pdo->beginTransaction(); moniEmitNotification($pdo,$u,$key,'security','Rollback','Rollback test','profile',null,null,true); $pdo->rollBack(); $q=$pdo->prepare('SELECT (SELECT COUNT(*) FROM notifications WHERE utilisateur_id=:u AND notification_key=:k)+(SELECT COUNT(*) FROM notification_events WHERE utilisateur_id=:u2 AND event_key=:k2)'); $q->execute(['u'=>$u,'k'=>$key,'u2'=>$u,'k2'=>$key]); echo $q->fetchColumn();"""
    atomic = subprocess.run(["php", "-r", atomic_php], capture_output=True, text=True, env=atomic_env, check=True)
    check(atomic.stdout.strip() == "0", "notification and outbox roll back atomically")
    status, _ = client.request("budgets.php", "POST", {"category": "transport", "limit": 200000, "month": month, "year": year})
    check(status == 201, "increase isolated test budget")
    for amount, expected in [(80000, "80"), (40000, "100"), (1, "over")]:
        status, _ = client.request("transactions.php", "POST", {"type": "expense", "amount": amount, "category": "transport", "date": "2026-11-13", "description": "crossing-" + expected})
        check(status == 201, "budget threshold transaction " + expected)
    _, response = client.request("notifications.php?limit=100")
    events = response["data"]["notifications"]
    check(any(row["type"] == "budget" and row["destination"] == "budgets" and row["resourceType"] == "budget" and row["resourceId"] for row in events), "budget event is structured and points to the budget resource")
    check(any("100 %" in row["text"] for row in events if row["type"] == "budget"), "100 percent crossing")
    check(any("dépassé" in row["text"] for row in events if row["type"] == "budget"), "over-limit crossing")
    status, _ = client.request("profile.php", "PATCH", {"alerts": {"budget": False, "subscriptions": False, "savings": False}})
    check(status == 200, "disable global alerts after history exists")
    _, retained = client.request("notifications.php?limit=100")
    check(any(row["type"] == "budget" for row in retained["data"]["notifications"]), "global switch preserves the existing notification history")
    status, _ = client.request("profile.php", "PATCH", {"alerts": {"budget": True, "subscriptions": True, "savings": True}})
    check(status == 200, "re-enable global alerts")

    status, saved = client.request("savings.php", "POST", {"name": "Projet test", "mode": "goal", "target": 100000, "date": "2026-11-20", "initial": 25000})
    check(status == 201, "create goal at 25 percent")
    goals = saved["data"]["state"].get("goals", [])
    goal = next((item for item in goals if item.get("name") == "Projet test"), None)
    check(goal is not None, "created goal returned")
    status, _ = client.request("savings.php", "POST", {"contribution": True, "goalId": goal["id"], "amount": 25000})
    check(status == 201, "goal contribution crosses 50 percent")
    status, _ = client.request("savings.php", "POST", {"contribution": True, "goalId": goal["id"], "amount": 25000})
    check(status == 201, "goal contribution crosses 75 percent")
    status, _ = client.request("savings.php", "POST", {"contribution": True, "goalId": goal["id"], "amount": 25000})
    check(status == 201, "goal contribution crosses 100 percent")
    _, savings_response = client.request("notifications.php?limit=100")
    savings_events = [row for row in savings_response["data"]["notifications"] if row["type"] == "savings" and row["resourceId"] == goal["id"]]
    for threshold in ("25 %", "50 %", "75 %", "100 %"):
        check(sum(threshold in row["text"] for row in savings_events) == 1, "savings milestone " + threshold + " is emitted once")

    status, _ = client.request("subscriptions.php", "POST", {"name": "Service test " + suffix, "amount": 1200, "billingDay": 16, "includedIn": None})
    check(status == 201, "create subscription for J-3 scheduler")
    status, _ = client.request("subscriptions.php", "POST", {"name": "Service J-1 " + suffix, "amount": 1200, "billingDay": 14, "includedIn": None})
    check(status == 201, "create subscription for J-1 scheduler")
    status, _ = client.request("subscriptions.php", "POST", {"name": "Service J " + suffix, "amount": 1200, "billingDay": 13, "includedIn": None})
    check(status == 201, "create subscription for same-day scheduler")
    status, _ = client.request("savings.php", "POST", {"name": "Rappel objectif " + suffix, "mode": "goal", "target": 100000, "date": "2026-11-20"})
    check(status == 201, "create unfinished goal for J-7 scheduler")
    status, _ = client.request("profile.php", "PATCH", {"email": f"events-updated-{suffix}@example.test"})
    check(status == 200, "change account email")

    env = os.environ.copy()
    env["MONI_TEST_NOW"] = "2026-11-13T12:00:00Z"
    result = subprocess.run(["php", "backend/notification-scheduler.php"], capture_output=True, text=True, env=env, check=True)
    check("scheduled_notifications=" in result.stdout, "scheduler runs at deterministic time")
    _, response = client.request("notifications.php?limit=100")
    events = response["data"]["notifications"]
    reminders = [row["text"] for row in events if row["type"] == "subscription"]
    check(any("3 jours" in text for text in reminders), "subscription J-3 reminder")
    check(any("demain" in text for text in reminders), "subscription J-1 reminder")
    check(any("aujourd’hui" in text for text in reminders), "subscription same-day reminder")
    check(any(row["type"] == "savings" and "J-7" in row["title"] for row in events), "goal J-7 reminder")
    check(any(row["type"] == "security" and row["destination"] == "profile" for row in events), "real email-change security event")

    subprocess.run(["php", "backend/notification-scheduler.php"], capture_output=True, text=True, env=env, check=True)
    _, second = client.request("notifications.php?limit=100")
    check(len(second["data"]["notifications"]) == len(events), "scheduler keys deduplicate after reconnect/run")

    env["MONI_TEST_NOW"] = "2026-12-01T12:00:00Z"
    subprocess.run(["php", "backend/notification-scheduler.php"], capture_output=True, text=True, env=env, check=True)
    _, month_response = client.request("notifications.php?limit=100")
    month_events = month_response["data"]["notifications"]
    check(any(row["type"] == "monthly" and "bilan" in row["text"] for row in month_events), "closed-month summary")
    check(any(row["type"] == "monthly" and "nouveau mois" in row["title"] for row in month_events), "new-month reminder")

    reset_client = Client()
    reset_email = register(reset_client, "ResetSecurity", suffix)
    _, reset_profile = reset_client.request("me.php")
    reset_user = reset_profile["data"]["state"]["profile"]["id"]
    reset_token = uuid.uuid4().hex + uuid.uuid4().hex
    reset_env = os.environ.copy()
    reset_env.update({"MONI_ASSERT_USER": str(reset_user), "MONI_ASSERT_TOKEN": reset_token})
    reset_seed = """require 'backend/database.php'; $pdo=moniConnect(); $q=$pdo->prepare('INSERT INTO password_reset_tokens (utilisateur_id,token_hash,expires_at) VALUES (:user,UNHEX(SHA2(:token,256)),DATE_ADD(UTC_TIMESTAMP(),INTERVAL 10 MINUTE))'); $q->execute(['user'=>(int)getenv('MONI_ASSERT_USER'),'token'=>getenv('MONI_ASSERT_TOKEN')]);"""
    subprocess.run(["php", "-r", reset_seed], check=True, env=reset_env)
    status, reset = Client().request("reset-password.php", "POST", {"token": reset_token, "password": "ResetSecurityPassword!123", "passwordConfirmation": "ResetSecurityPassword!123"}, csrf=False)
    check(status == 200 and reset["data"]["reset"], "supported password reset completes")
    after_reset = Client()
    status, _ = after_reset.request("login.php", "POST", {"email": reset_email, "password": "ResetSecurityPassword!123"}, csrf=False)
    check(status == 200, "reset account can authenticate with new password")
    _, security_response = after_reset.request("notifications.php?limit=100")
    check(any(row["type"] == "security" and row["title"] == "Mot de passe modifié" for row in security_response["data"]["notifications"]), "real password-reset security alert")
    print(f"NOTIFICATIONS_BUSINESS_PASS: user={user}, budget thresholds, savings 25/50/75/100, scheduler J-3/J-1/J/J-7/month, security email/password-reset, preference switch, idempotence")


if __name__ == "__main__":
    main()
