from pathlib import Path
"""N5A registration, CSRF, tenant isolation, rate limit and logout revoke checks."""
import os
import subprocess
import sys
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from validation_guard import require_isolated_validation_pool
from notifications_isolated_validation import Client, check, register


def b64url(value):
    import base64
    return base64.urlsafe_b64encode(value).decode().rstrip("=")


def seed_pending_delivery(user_id, device_id, event_key):
    env = os.environ.copy()
    env.update({"MONI_ASSERT_USER": str(user_id), "MONI_ASSERT_DEVICE": str(device_id), "MONI_ASSERT_EVENT": event_key})
    code = """require 'backend/database.php'; $pdo=moniConnect(); $pdo->beginTransaction(); $q=$pdo->prepare(\"INSERT INTO notification_events (utilisateur_id,event_key,event_type,destination,payload_json,due_at,next_attempt_at,expires_at,status,created_at) VALUES (:user,:key,'security','profile','{}',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)+INTERVAL 1 DAY,'queued',UTC_TIMESTAMP(6))\"); $q->execute(['user'=>(int)getenv('MONI_ASSERT_USER'),'key'=>getenv('MONI_ASSERT_EVENT')]); $event=(int)$pdo->lastInsertId(); $q=$pdo->prepare(\"INSERT INTO push_deliveries (event_id,device_id,status,next_attempt_at,expires_at,attempts,updated_at) VALUES (:event,:device,'pending',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)+INTERVAL 1 DAY,0,UTC_TIMESTAMP(6))\"); $q->execute(['event'=>$event,'device'=>(int)getenv('MONI_ASSERT_DEVICE')]); $pdo->commit();"""
    subprocess.run(["php", "-r", code], check=True, env=env)


def assert_devices_after_revoke(first_device, second_device):
    env = os.environ.copy()
    env.update({"MONI_ASSERT_FIRST": str(first_device), "MONI_ASSERT_SECOND": str(second_device)})
    code = """require 'backend/database.php'; $pdo=moniConnect(); $q=$pdo->prepare('SELECT active,LENGTH(subscription_ciphertext) AS bytes FROM push_devices WHERE id=:id'); $q->execute(['id'=>(int)getenv('MONI_ASSERT_FIRST')]); $first=$q->fetch(); $q->execute(['id'=>(int)getenv('MONI_ASSERT_SECOND')]); $second=$q->fetch(); $q=$pdo->prepare(\"SELECT COUNT(*) FROM push_deliveries WHERE device_id=:id AND status='cancelled'\"); $q->execute(['id'=>(int)getenv('MONI_ASSERT_FIRST')]); if (!$first || !$second || (int)$first['active'] !== 0 || (int)$first['bytes'] !== 0 || (int)$second['active'] !== 1 || (int)$second['bytes'] < 1 || (int)$q->fetchColumn() !== 1) exit(1);"""
    subprocess.run(["php", "-r", code], check=True, env=env)


def main():
    require_isolated_validation_pool()
    suffix = uuid.uuid4().hex[:10]
    a, b = Client(), Client()
    email_a = register(a, "DeviceA", suffix)
    email_b = register(b, "DeviceB", suffix)
    for client, email in ((a, email_a), (b, email_b)):
        status, _ = client.request("login.php", "POST", {"email": email, "password": "ValidationPassword!123"}, csrf=False)
        check(status == 200, "account login before device operations")
    sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/isolated-" + suffix, "keys": {"p256dh": b64url(bytes.fromhex("046b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c2964fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")), "auth": b64url(b"\x02" * 16)}}
    payload = {"subscription": sub, "timezone": "Africa/Casablanca"}

    status, no_csrf = a.request("push-subscriptions.php", "POST", payload, csrf=False)
    check(status == 403 and no_csrf["error"]["code"] == "CSRF_INVALID", "device registration requires CSRF")
    status, invalid = a.request("push-subscriptions.php", "POST", {"subscription": sub, "timezone": "../private"})
    check(status == 422, "invalid timezone rejected")
    status, saved = a.request("push-subscriptions.php", "POST", payload)
    check(status == 201 and saved["data"].get("deviceId"), "device registered")
    device_id = saved["data"]["deviceId"]
    check("endpoint" not in str(saved), "endpoint never returned by API")
    second = {"endpoint": "https://fcm.googleapis.com/fcm/send/isolated-second-" + suffix, "keys": sub["keys"]}
    status, saved_second = a.request("push-subscriptions.php", "POST", {"subscription": second, "timezone": "Africa/Casablanca"})
    check(status == 201 and saved_second["data"].get("deviceId"), "second device registered")
    second_device_id = saved_second["data"]["deviceId"]
    _, account = a.request("me.php")
    user_id = account["data"]["state"]["profile"]["id"]
    seed_pending_delivery(user_id, device_id, "revoke-pending:" + suffix)

    status, foreign = b.request("push-subscriptions.php", "POST", payload)
    check(status == 409 and foreign["error"]["code"] == "DEVICE_OWNED", "device cannot be transferred across accounts")
    status, owner_status = a.request("push-subscriptions.php")
    check(status == 200 and owner_status["data"]["activeDevices"] == 2 and owner_status["data"]["currentDevice"] == second_device_id, "push status exposes the latest owner device")
    status, csrf = a.request("push-subscriptions.php", "DELETE", {"deviceId": device_id}, csrf=False)
    check(status == 403 and csrf["error"]["code"] == "CSRF_INVALID", "revocation requires CSRF")
    status, idor = b.request("push-subscriptions.php", "DELETE", {"deviceId": device_id})
    check(status == 404, "cross-account revocation blocked")
    status, revoked = a.request("push-subscriptions.php", "DELETE", {"deviceId": device_id})
    check(status == 200 and revoked["data"]["revoked"], "device revoked by owner")
    assert_devices_after_revoke(device_id, second_device_id)
    status, reclaimed = b.request("push-subscriptions.php", "POST", payload)
    check(status == 201 and reclaimed["data"]["deviceId"] == device_id, "logged-out device can be enrolled by the next account")

    for _ in range(8):
        status, _ = a.request("push-subscriptions.php", "POST", {"subscription": second, "timezone": "Africa/Casablanca"})
        check(status == 201, "within registration rate limit")
    status, limited = a.request("push-subscriptions.php", "POST", {"subscription": second, "timezone": "Africa/Casablanca"})
    check(status == 429 and limited["error"]["code"] == "RATE_LIMITED", "registration rate limit enforced")

    logout_payload = {"_unused": True}
    status, _ = a.request("logout.php", "POST", logout_payload)
    check(status == 200, "logout succeeds after registered device")
    env = os.environ.copy()
    env["MONI_ASSERT_DEVICE_ID"] = str(second_device_id)
    command = "require 'backend/database.php'; $pdo=moniConnect(); $q=$pdo->prepare('SELECT active, subscription_ciphertext FROM push_devices WHERE id=:id'); $q->execute(['id'=>(int)getenv('MONI_ASSERT_DEVICE_ID')]); $r=$q->fetch(); if (!$r || (int)$r['active'] !== 0 || $r['subscription_ciphertext'] !== '') exit(1);"
    subprocess.run(["php", "-r", command], check=True, env=env)
    status, login = a.request("login.php", "POST", {"email": email_a, "password": "ValidationPassword!123"}, csrf=False)
    check(status == 200, "account can reconnect after logout")
    print("PUSH_DEVICES_ISOLATED_PASS: csrf, timezone, AEAD storage, account/device isolation and safe reassignment after logout, pending delivery revocation, rate limit, endpoint privacy, logout revocation")


if __name__ == "__main__":
    require_isolated_validation_pool()
    main()
