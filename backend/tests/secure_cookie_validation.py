"""Check cookie attributes emitted when MONI_COOKIE_SECURE=1."""
import json
import os
import ssl
import sys
import urllib.request
import uuid

from validation_guard import require_isolated_validation_pool


BASE = os.environ.get("MONI_TEST_BASE", "http://127.0.0.1:8081")
ORIGIN = os.environ.get("MONI_TEST_ORIGIN", "https://moni.example.test")


def main():
    require_isolated_validation_pool()
    body = json.dumps({"name": "Secure Cookie", "email": f"cookie-{uuid.uuid4().hex[:10]}@example.test", "password": "ValidationPassword!123", "currency": "XOF"}).encode()
    request = urllib.request.Request(BASE + "/register.php", data=body, headers={"Content-Type": "application/json", "Origin": ORIGIN}, method="POST")
    context = ssl._create_unverified_context() if os.environ.get("MONI_TEST_INSECURE_TLS") == "1" else None
    with urllib.request.urlopen(request, timeout=10, context=context) as response:
        cookies = "\n".join(response.headers.get_all("Set-Cookie") or [])
        cors = response.headers.get("Access-Control-Allow-Origin")
    lowered = cookies.lower()
    assert "secure" in lowered and "httponly" in lowered and "samesite=lax" in lowered and "path=/" in lowered, cookies
    assert cors == ORIGIN, cors
    print("Secure cookie validation passed: Secure, HttpOnly, SameSite=Lax, exact CORS origin")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"Secure cookie validation failed: {error}", file=sys.stderr)
        raise
