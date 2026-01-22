#!/usr/bin/env python3
"""
PandaDoc Token Refresh Script

This script:
1. Uses Playwright to login to PandaDoc and capture a fresh Bearer token
2. Updates the token in Supabase pandadoc_config table
3. Can be run via cron/launchd to keep the token fresh

Usage:
    python3 refresh_pandadoc_token.py

Environment variables (from .env.local):
    PANDADOC_LOGIN_EMAIL - PandaDoc login email
    PANDADOC_LOGIN_PASSWORD - PandaDoc login password
    SUPABASE_URL - Supabase project URL
    SUPABASE_SERVICE_ROLE_KEY - Supabase service role key
"""

import os
import sys
import json
import logging
import time
from pathlib import Path
from datetime import datetime, timezone, timedelta

# Setup logging
logging.basicConfig(
    format="%(asctime)s %(levelname)s %(message)s",
    level=logging.INFO,
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(Path(__file__).parent / "pandadoc_refresh.log")
    ]
)

# Load environment variables
def load_env():
    env_file = Path(__file__).parent.parent / ".env.local"
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if not line or line.strip().startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"'))

load_env()

# Configuration
PANDADOC_LOGIN_EMAIL = os.getenv("PANDADOC_LOGIN_EMAIL", "jbutt@marswater.com")
PANDADOC_LOGIN_PASSWORD = os.getenv("PANDADOC_LOGIN_PASSWORD")
SUPABASE_URL = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

PANDA_LOGIN_URL = "https://app.pandadoc.com/login/"
DOCUMENTS_URL = "https://app.pandadoc.com/a/#/documents-next"

# Storage paths
SCRIPT_DIR = Path(__file__).parent
STORAGE_STATE_FILE = SCRIPT_DIR / "panda_storage_state.json"


def obtain_token_via_playwright(email: str, password: str, headless: bool = True, max_wait: int = 60):
    """
    Launches a browser, logs into PandaDoc, and captures the Bearer token.
    """
    try:
        from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
    except ImportError:
        logging.error("Playwright not installed. Run: pip3 install playwright && python3 -m playwright install chromium")
        sys.exit(1)

    if not email or not password:
        raise RuntimeError("Missing PANDADOC_LOGIN_EMAIL or PANDADOC_LOGIN_PASSWORD")

    logging.info("Launching Playwright (headless=%s)...", headless)

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=headless)
        context = browser.new_context(
            storage_state=str(STORAGE_STATE_FILE) if STORAGE_STATE_FILE.exists() else None
        )
        page = context.new_page()

        bearer_holder = {"token": None}

        def on_request(request):
            if bearer_holder["token"]:
                return
            try:
                url = request.url
                if "api.pandadoc.com" not in url:
                    return
                headers = request.headers
                auth = headers.get("authorization") or headers.get("Authorization")
                if auth and auth.lower().startswith("bearer "):
                    token = auth.split(" ", 1)[1].strip()
                    if token:
                        bearer_holder["token"] = token
                        logging.info("Captured Bearer token (length=%d)", len(token))
            except Exception as e:
                logging.warning("on_request handler error: %s", e)

        page.on("request", on_request)

        logging.info("Navigating to Documents UI...")
        page.goto(DOCUMENTS_URL, wait_until="domcontentloaded", timeout=60000)

        # Check if login is needed
        login_needed = False
        try:
            page.wait_for_selector("input[type='email'], #email, input[name='email']", timeout=5000)
            login_needed = True
            logging.info("Login form detected")
        except PlaywrightTimeoutError:
            logging.info("No login form - using existing session")

        if login_needed:
            # Fill email
            for sel in ["#email", "input[name='email']", "input[type='email']"]:
                try:
                    page.fill(sel, email)
                    break
                except Exception:
                    continue

            # Fill password
            for sel in ["#password", "input[name='password']", "input[type='password']"]:
                try:
                    page.fill(sel, password)
                    break
                except Exception:
                    continue

            # Submit
            try:
                page.get_by_role("button", name="Log in").click()
            except Exception:
                page.click("button[type='submit']")

            logging.info("Submitted login form...")
            try:
                page.wait_for_load_state("networkidle", timeout=60000)
            except PlaywrightTimeoutError:
                pass

        # Wait for token
        logging.info("Waiting for Bearer token...")
        start = time.time()
        while not bearer_holder["token"] and (time.time() - start) < max_wait:
            page.wait_for_timeout(1000)

        token_value = bearer_holder["token"]
        if not token_value:
            context.storage_state(path=str(STORAGE_STATE_FILE))
            browser.close()
            raise RuntimeError("Failed to capture Bearer token")

        logging.info("Successfully captured token: %s...", token_value[:12])
        context.storage_state(path=str(STORAGE_STATE_FILE))
        browser.close()
        return token_value


def update_supabase_token(token: str):
    """
    Updates the token in Supabase pandadoc_config table.
    """
    import subprocess

    if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")

    url = f"{SUPABASE_URL}/rest/v1/pandadoc_config?id=eq.1"
    expires_at = (datetime.now(timezone.utc) + timedelta(days=10)).isoformat()

    data = json.dumps({
        "api_token": token,
        "token_expires_at": expires_at,
        "last_refreshed_at": datetime.now(timezone.utc).isoformat(),
        "refresh_count": 1
    })

    # Use curl to avoid Python SSL issues on macOS
    result = subprocess.run([
        "curl", "-s", "-w", "%{http_code}", "-o", "/dev/null",
        "-X", "PATCH", url,
        "-H", f"apikey: {SUPABASE_SERVICE_KEY}",
        "-H", f"Authorization: Bearer {SUPABASE_SERVICE_KEY}",
        "-H", "Content-Type: application/json",
        "-H", "Prefer: return=minimal",
        "-d", data
    ], capture_output=True, text=True)

    status_code = result.stdout.strip()
    if status_code in ("200", "204"):
        logging.info("Supabase update successful (status=%s)", status_code)
        return True
    else:
        logging.error("Supabase update failed: status=%s, stderr=%s", status_code, result.stderr)
        return False


def main():
    logging.info("=" * 50)
    logging.info("PandaDoc Token Refresh Starting")
    logging.info("=" * 50)

    try:
        # Get fresh token
        token = obtain_token_via_playwright(
            PANDADOC_LOGIN_EMAIL,
            PANDADOC_LOGIN_PASSWORD,
            headless=True,
            max_wait=120
        )

        # Update Supabase
        if update_supabase_token(token):
            logging.info("Token refresh complete!")
            logging.info("New token expires: %s",
                        (datetime.now(timezone.utc) + timedelta(days=10)).isoformat())
        else:
            logging.error("Failed to update Supabase")
            sys.exit(1)

    except Exception as e:
        logging.error("Token refresh failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
