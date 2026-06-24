#!/usr/bin/env python3
"""Stop hook — edit Discord placeholder to show completion, clear ctx."""
import json, os, urllib.request

CTX_FILE = "/tmp/aio-discord-ctx.json"

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

def delete_message(token, channel_id, message_id):
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}"
    req = urllib.request.Request(url, method="DELETE", headers={
        "Authorization": f"Bot {token}",
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 10)"
    })
    try:
        with urllib.request.urlopen(req, timeout=5):
            pass
    except Exception:
        pass

def main():
    if os.environ.get("DISCORD_SESSION") != "1":
        return
    if not os.environ.get("DISCORD_STATE_DIR"):  # Pom-Pom's default profile, skip
        return
    if not os.path.exists(CTX_FILE):
        return
    try:
        with open(CTX_FILE) as f:
            ctx = json.load(f)
    except Exception:
        return

    chat_id = ctx.get("chat_id")
    message_id = ctx.get("message_id")
    if chat_id and message_id:
        token = get_token()
        if token:
            delete_message(token, chat_id, message_id)

    try:
        os.remove(CTX_FILE)
    except Exception:
        pass

if __name__ == "__main__":
    main()
