#!/usr/bin/env python3
"""Lifecycle hook — post a Discord ping for PreCompact/PostCompact/SubagentStop/StopFailure/PermissionRequest/Notification(rate-limit)."""
import json, sys, os, urllib.request

CTX_FILE = "/tmp/aio-discord-ctx.json"
FALLBACK_CHAT_ID = "1519020450322317362"

RATE_LIMIT_KEYWORDS = ("rate limit", "usage limit", "limit reached", "limit reset", "limits reset")

LABELS = {
    "PreCompact": "🧠 Đang compact session...",
    "PostCompact": "✅ Compact xong rồi~",
    "SubagentStop": "🤖 Sub-agent đã xong task con",
    "StopFailure": "❌ Lượt vừa rồi bị lỗi/crash giữa đường",
    "PermissionRequest": "⚠️ Đang chờ anh approve 1 hành động",
}

def get_token():
    env_path = "/home/swegon/AI_Agent/Aio_project/.claude/channels/discord/.env"
    try:
        with open(env_path) as f:
            for line in f:
                if line.startswith("DISCORD_BOT_TOKEN="):
                    return line.strip().split("=", 1)[1]
    except Exception:
        pass
    return None

def get_chat_id():
    try:
        with open(CTX_FILE) as f:
            ctx = json.load(f)
        cid = ctx.get("chat_id")
        if cid:
            return str(cid)
    except Exception:
        pass
    return FALLBACK_CHAT_ID

def post_message(token, channel_id, text):
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
    data = json.dumps({"content": text}).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 10)"
    })
    try:
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception as e:
        with open("/tmp/aio-lifecycle-notify.log", "a") as log:
            log.write(f"post_message error: {e}\n")

def main():
    if os.environ.get("DISCORD_SESSION") != "1":
        return
    if not os.environ.get("DISCORD_STATE_DIR"):  # Pom-Pom's default profile, skip
        return
    if len(sys.argv) < 2:
        return
    event = sys.argv[1]

    try:
        hook_data = json.loads(sys.stdin.read())
    except Exception:
        hook_data = {}

    if event == "Notification":
        msg = (hook_data.get("message") or "").lower()
        if not any(k in msg for k in RATE_LIMIT_KEYWORDS):
            return
        text = f"🚦 Rate-limit notice: {hook_data.get('message')}"
    else:
        text = LABELS.get(event)
        if not text:
            return
        extra = hook_data.get("agent_type") or hook_data.get("agent_id")
        if event == "SubagentStop" and extra:
            text += f" ({extra})"

    token = get_token()
    if not token:
        return
    post_message(token, get_chat_id(), text)

if __name__ == "__main__":
    main()
