#!/usr/bin/env python3
"""UserPromptSubmit hook — post Discord thinking placeholder, save ctx for live updates."""
import json, re, sys, os, urllib.request, urllib.error

def get_token():
    env_path = os.path.expanduser("/home/swegon/AI_Agent/Aio_project/.claude/channels/discord/.env")
    try:
        with open(env_path) as f:
            for line in f:
                if line.startswith("DISCORD_BOT_TOKEN="):
                    return line.strip().split("=", 1)[1]
    except Exception:
        pass
    return None

def get_chat_id_from_prompt(prompt):
    m = re.search(r'chat_id[^0-9a-zA-Z_]{1,4}(\d{17,20})', prompt)
    return m.group(1) if m else None

def post_message(token, channel_id, text):
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages"
    data = json.dumps({"content": text}).encode()
    req = urllib.request.Request(url, data=data, headers={
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 10)"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return json.loads(r.read())
    except Exception as e:
        with open("/tmp/aio-discord-indicator.log", "a") as log:
            log.write(f"post_message error: {e}\n")
        return None

def main():
    # Only run in Aio's Discord bot service session
    if os.environ.get("DISCORD_SESSION") != "1":
        return
    if not os.environ.get("DISCORD_STATE_DIR"):  # Pom-Pom's default profile, skip
        return

    try:
        hook_data = json.loads(sys.stdin.read())
    except Exception:
        return

    transcript_path = hook_data.get("transcript_path", "")
    prompt = hook_data.get("prompt", "")

    chat_id = get_chat_id_from_prompt(prompt)
    if not chat_id:
        return

    token = get_token()
    if not token:
        return

    msg = post_message(token, chat_id, "⏳ Aio đang xử lý...")
    if not msg:
        return

    import time
    session_id = os.path.basename(transcript_path).replace(".jsonl", "")
    ctx = {
        "chat_id": chat_id,
        "message_id": str(msg["id"]),
        "tools": [],
        "session_id": session_id,
        "created_at": time.time(),
    }
    with open("/tmp/aio-discord-ctx.json", "w") as f:
        json.dump(ctx, f)

if __name__ == "__main__":
    main()
