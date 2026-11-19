from pathlib import Path
"""N5B worker checks; Minishlink uses an in-memory PSR-18 transport only."""
import base64
import json
import os
import subprocess
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation_guard import require_isolated_validation_pool
from notifications_isolated_validation import Client, check, register


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))


def b64url(value):
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def event_key(category, month):
    return f"budget:{month}:{category}:80"


def set_events_due(user_id):
    env = os.environ.copy()
    env["MONI_ASSERT_USER"] = str(user_id)
    code = 'require \'backend/database.php\'; $pdo=moniConnect(); $pdo->prepare("UPDATE notification_events SET due_at=UTC_TIMESTAMP(6)-INTERVAL 1 DAY,next_attempt_at=UTC_TIMESTAMP(6)-INTERVAL 1 DAY WHERE utilisateur_id=:u AND status=\'pending\'")->execute([\'u\'=>(int)getenv(\'MONI_ASSERT_USER\')]);'
    result = subprocess.run(["php", "-r", code], cwd=ROOT, env=env, capture_output=True, text=True)
    if result.returncode: raise RuntimeError(result.stderr)


def make_event(label, suffix, categories):
    client = Client()
    register(client, label, suffix)
    status, _ = client.request("profile.php", "PATCH", {"alerts": {"budget": True, "subscriptions": True, "savings": True}})
    check(status == 200, "enable financial alerts")
    _, me = client.request("me.php")
    user_id = me["data"]["state"]["profile"]["id"]
    month, year, date = "2026-11", 2026, "2026-11-13"
    for category in categories:
        status, _ = client.request("budgets.php", "POST", {"category": category, "limit": 100000, "month": 11, "year": year})
        check(status == 201, "create budget for " + category)
        status, _ = client.request("transactions.php", "POST", {"type": "expense", "amount": 80000, "category": category, "date": date, "description": "worker-" + category})
        check(status == 201, "create event for " + category)
    set_events_due(user_id)
    return client, user_id, month


def register_device(client, suffix, index=0, timezone="America/Los_Angeles"):
    endpoint = f"https://fcm.googleapis.com/fcm/send/worker-{suffix}-{index}"
    subscription = {"endpoint": endpoint, "keys": {"p256dh": b64url(bytes.fromhex("046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")), "auth": b64url(b"\x02" * 16)}}
    status, result = client.request("push-subscriptions.php", "POST", {"subscription": subscription, "timezone": timezone})
    check(status == 201, "register isolated device")
    return result["data"]["deviceId"]


def worker(status="202", concurrent=False):
    env = os.environ.copy()
    env.update({"MONI_TEST_POOL": "moni-validation", "MONI_PUSH_TRANSPORT": "simulated", "MONI_PUSH_ENABLED": "1", "MONI_PUSH_SIMULATED_STATUS": status,
                "MONI_COMPOSER_AUTOLOAD": os.path.join(ROOT, "backend", "vendor", "autoload.php"),
                "OPENSSL_CONF": r"C:\Program Files\PHP\current\extras\ssl\openssl.cnf"})
    command = ["php", "backend/notification-worker.php"]
    if concurrent:
        first = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        second = subprocess.Popen(command, cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        outputs = [first.communicate(timeout=120), second.communicate(timeout=120)]
        check(first.returncode == 0 and second.returncode == 0, "concurrent workers finish: " + repr(outputs))
        return outputs
    result = subprocess.run(command, cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    check(result.returncode == 0, "worker exits successfully: " + repr((result.stdout, result.stderr)))
    return result.stdout


def configure_test_vapid_keys():
    code = "$key=openssl_pkey_new(['private_key_type'=>OPENSSL_KEYTYPE_EC,'curve_name'=>'prime256v1']); $ec=openssl_pkey_get_details($key)['ec']; $encode=static fn(string $value): string => rtrim(strtr(base64_encode($value), '+/', '-_'), '='); echo json_encode(['public'=>$encode(\"\\x04\".$ec['x'].$ec['y']),'private'=>$encode($ec['d'])], JSON_THROW_ON_ERROR);"
    env = os.environ.copy()
    env["OPENSSL_CONF"] = r"C:\Program Files\PHP\current\extras\ssl\openssl.cnf"
    result = subprocess.run(["php", "-r", code], capture_output=True, text=True, check=True, env=env)
    keys = json.loads(result.stdout)
    os.environ["MONI_VAPID_PUBLIC_KEY"] = keys["public"]
    os.environ["MONI_VAPID_PRIVATE_KEY"] = keys["private"]


def assert_live_transport_locked():
    env = os.environ.copy()
    env.update({"MONI_TEST_POOL": "moni-validation", "MONI_PUSH_TRANSPORT": "live", "MONI_PUSH_ENABLED": "1",
                "MONI_COMPOSER_AUTOLOAD": os.path.join(ROOT, "backend", "vendor", "autoload.php"),
                "OPENSSL_CONF": r"C:\Program Files\PHP\current\extras\ssl\openssl.cnf"})
    env.pop("MONI_TEST_PUSH_DEVICE_AUTHORIZED", None)
    result = subprocess.run(["php", "backend/notification-worker.php"], cwd=ROOT, env=env, capture_output=True, text=True, timeout=120)
    check(result.returncode != 0 and "[moni-notification-worker] RuntimeException" in result.stderr and "events=" not in result.stdout, "live transport is locked without explicit authorized test device")


def db_state(user_id, key, mode="read"):
    env = os.environ.copy()
    env["MONI_ASSERT_USER"] = str(user_id)
    env["MONI_ASSERT_KEY"] = key
    env["MONI_ASSERT_MODE"] = mode
    code = """
require 'backend/database.php'; $pdo=moniConnect(); $u=(int)getenv('MONI_ASSERT_USER'); $key=getenv('MONI_ASSERT_KEY');
$q=$pdo->prepare('SELECT id,status,attempts FROM notification_events WHERE utilisateur_id=:u AND event_key=:k'); $q->execute(['u'=>$u,'k'=>$key]); $e=$q->fetch();
if (!$e) { echo '{}'; exit; }
if (getenv('MONI_ASSERT_MODE')==='retry') $pdo->prepare("UPDATE push_deliveries SET next_attempt_at=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE event_id=:id AND status='pending'")->execute(['id'=>$e['id']]);
if (getenv('MONI_ASSERT_MODE')==='lease') $pdo->prepare("UPDATE notification_events SET status='processing',lease_owner='crashed-worker',lease_until=UTC_TIMESTAMP(6)-INTERVAL 1 SECOND WHERE id=:id")->execute(['id'=>$e['id']]);
$d=$pdo->prepare('SELECT d.status,d.attempts,p.active,LENGTH(p.subscription_ciphertext) AS ciphertext_length FROM push_deliveries d JOIN push_devices p ON p.id=d.device_id WHERE d.event_id=:id ORDER BY d.id LIMIT 1'); $d->execute(['id'=>$e['id']]); $delivery=$d->fetch() ?: null;
$q=$pdo->prepare('SELECT COALESCE(MAX(reserved_count),0) FROM push_daily_quota WHERE utilisateur_id=:u'); $q->execute(['u'=>$u]);
echo json_encode(['event'=>$e,'delivery'=>$delivery,'quota'=>(int)$q->fetchColumn()], JSON_THROW_ON_ERROR);
"""
    result = subprocess.run(["php", "-r", code], cwd=ROOT, env=env, capture_output=True, text=True)
    if result.returncode: raise RuntimeError(result.stderr)
    return json.loads(result.stdout or "{}")


def main():
    require_isolated_validation_pool()
    configure_test_vapid_keys()
    suffix = uuid.uuid4().hex[:8]
    client, user, month = make_event("WorkerQuota", suffix, ["transport", "rent", "groceries", "unexpected"])
    _, push_config = client.request("push-config.php")
    check(push_config["data"]["enabled"] is False, "public push activation remains disabled")
    status, push_status = client.request("push-subscriptions.php")
    check(status == 200 and push_status["data"]["enabled"] is False, "push status is authenticated and respects the disabled runtime")
    status, test_response = client.request("push-test.php", "POST", {})
    check(status == 503 and test_response["error"]["code"] == "PUSH_UNAVAILABLE", "test push stays closed while runtime push is disabled")
    assert_live_transport_locked()
    register_device(client, suffix)

    prefs_suffix = uuid.uuid4().hex[:8]
    prefs_client, prefs_user, month = make_event("WorkerPreference", prefs_suffix, ["transport"])
    register_device(prefs_client, prefs_suffix)
    status, _ = prefs_client.request("profile.php", "PATCH", {"alerts": {"budget": False, "subscriptions": False, "savings": False}})
    check(status == 200, "disable global alerts before push dispatch")
    worker("202")
    preference_event = db_state(prefs_user, event_key("transport", month))
    check(preference_event["event"]["status"] == "skipped_preference" and preference_event["delivery"] is None, "global financial switch suppresses pending push without deleting internal history")
    _, retained = prefs_client.request("notifications.php?limit=100")
    check(any(item["type"] == "budget" for item in retained["data"]["notifications"]), "preference switch retains internal history")

    worker("202")
    states = [db_state(user, event_key(category, month)) for category in ["transport", "rent", "groceries", "unexpected"]]
    check(sum(1 for state in states if state["delivery"] and state["delivery"]["status"] == "accepted") == 3, "only three financial events delivered per account/day: " + repr(states))
    check(states[0]["quota"] == 3 and any(state["event"]["status"] == "suppressed_quota" for state in states), "atomic daily quota")

    lease_suffix = uuid.uuid4().hex[:8]
    lease_client, lease_user, month = make_event("WorkerRecovery", lease_suffix, ["transport"])
    register_device(lease_client, lease_suffix)
    lease_key = event_key("transport", month)
    db_state(lease_user, lease_key, "lease")
    worker("202")
    check(db_state(lease_user, lease_key)["delivery"]["status"] == "accepted", "expired event lease recovers after worker interruption")

    obsolete_suffix = uuid.uuid4().hex[:8]
    obsolete_client, obsolete_user, month = make_event("WorkerObsolete", obsolete_suffix, ["transport"])
    register_device(obsolete_client, obsolete_suffix)
    _, transaction_list = obsolete_client.request("transactions.php")
    transaction = next(item for item in transaction_list["data"]["transactions"] if item["description"] == "worker-transport")
    status, _ = obsolete_client.request("transactions.php", "DELETE", {"id": transaction["id"]})
    check(status == 200, "remove crossing before dispatch")
    worker("202")
    obsolete = db_state(obsolete_user, event_key("transport", month))
    check(obsolete["event"]["status"] == "cancelled" and obsolete["delivery"] is None, "obsolete budget event is cancelled before a push")

    stale_suffix = uuid.uuid4().hex[:8]
    stale_client = Client()
    register(stale_client, "WorkerStaleSubscription", stale_suffix)
    _, stale_profile = stale_client.request("me.php")
    stale_user = stale_profile["data"]["state"]["profile"]["id"]
    register_device(stale_client, stale_suffix, timezone="UTC")
    status, _ = stale_client.request("subscriptions.php", "POST", {"name": "Stale subscription " + stale_suffix, "amount": 1200, "billingDay": 16, "includedIn": None})
    check(status == 201, "create subscription before stale reminder test")
    _, subscriptions = stale_client.request("subscriptions.php")
    subscription = next(item for item in subscriptions["data"]["subscriptions"] if item["name"] == "Stale subscription " + stale_suffix)
    scheduler_env = os.environ.copy()
    scheduler_env.update({"MONI_TEST_POOL": "moni-validation", "MONI_TEST_NOW": "2026-11-13T12:00:00Z"})
    subprocess.run(["php", "backend/notification-scheduler.php"], cwd=ROOT, env=scheduler_env, check=True, capture_output=True, text=True)
    set_events_due(stale_user)
    status, _ = stale_client.request("subscriptions.php", "DELETE", {"id": subscription["id"]})
    check(status == 200, "delete subscription before dispatch")
    worker("202")
    stale = db_state(stale_user, f"subscription:{subscription['id']}:2026-11-16:3")
    check(stale["event"]["status"] == "cancelled" and stale["delivery"] is None, "obsolete subscription reminder is cancelled before a push")

    retry_suffix = uuid.uuid4().hex[:8]
    retry_client, retry_user, month = make_event("WorkerRetry", retry_suffix, ["transport"])
    register_device(retry_client, retry_suffix)
    retry_key = event_key("transport", month)
    worker("429")
    first = db_state(retry_user, retry_key)
    check(first["delivery"]["status"] == "pending" and first["delivery"]["attempts"] == 1, "429 schedules a bounded retry")
    db_state(retry_user, retry_key, "retry")
    worker("202")
    check(db_state(retry_user, retry_key)["delivery"]["status"] == "accepted", "retry accepts provider response")

    for status_code in ("500", "503"):
        retry_suffix = uuid.uuid4().hex[:8]
        retry_client, retry_user, month = make_event("WorkerRetry" + status_code, retry_suffix, ["transport"])
        register_device(retry_client, retry_suffix)
        key = event_key("transport", month)
        worker(status_code)
        response = db_state(retry_user, key)
        check(response["delivery"]["status"] == "pending" and response["delivery"]["attempts"] == 1, status_code + " schedules a bounded retry")
        db_state(retry_user, key, "retry")
        worker("202")
        check(db_state(retry_user, key)["delivery"]["status"] == "accepted", status_code + " retry completes")

    for status in ("404", "410"):
        expired_suffix = uuid.uuid4().hex[:8]
        expired_client, expired_user, month = make_event("WorkerExpire" + status, expired_suffix, ["transport"])
        register_device(expired_client, expired_suffix)
        worker(status)
        expired = db_state(expired_user, event_key("transport", month))
        check(expired["delivery"]["status"] == "expired" and expired["delivery"]["active"] == 0 and expired["delivery"]["ciphertext_length"] == 0, status + " deactivates and clears device")

    concurrent_suffix = uuid.uuid4().hex[:8]
    concurrent_client, concurrent_user, month = make_event("WorkerRace", concurrent_suffix, ["transport"])
    register_device(concurrent_client, concurrent_suffix)
    worker("202", concurrent=True)
    race = db_state(concurrent_user, event_key("transport", month))
    check(race["delivery"]["status"] == "accepted" and race["delivery"]["attempts"] == 1, "concurrent workers claim a delivery once")
    print("NOTIFICATIONS_WORKER_PASS: Minishlink simulated 202/404/410/429/5xx, retry, atomic daily quota, lease recovery, obsolete budget/subscription cancellation, concurrent workers; no network sends")


if __name__ == "__main__":
    require_isolated_validation_pool()
    main()
