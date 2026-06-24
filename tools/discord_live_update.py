#!/usr/bin/env python3
"""PostToolUse hook — edit Discord placeholder with live tool progress."""
import json, sys, os, urllib.request

CTX_FILE = "/tmp/aio-discord-ctx.json"
TOOL_ICONS = {
    "Bash": "🖥️", "Read": "📖", "Write": "✍️", "Edit": "✏️",
    "Glob": "🔍", "Grep": "🔎", "Agent": "🤖", "WebFetch": "🌐",
    "WebSearch": "🔎", "mcp__plugin_discord_discord__reply": "💬",
    "mcp__plugin_discord_discord__fetch_messages": "📥",
    "mcp__plugin_discord_discord__edit_message": "✏️",
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

def edit_message(token, channel_id, message_id, text):
    url = f"https://discord.com/api/v10/channels/{channel_id}/messages/{message_id}"
    data = json.dumps({"content": text}).encode()
    req = urllib.request.Request(url, data=data, method="PATCH", headers={
        "Authorization": f"Bot {token}",
        "Content-Type": "application/json",
        "User-Agent": "DiscordBot (https://github.com/discord/discord-api-docs, 10)"
    })
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            return r.status
    except Exception:
        return None

def main():
    import time
    # Only run in Aio's Discord bot service session
    if os.environ.get("DISCORD_SESSION") != "1":
        return
    if not os.environ.get("DISCORD_STATE_DIR"):  # Pom-Pom's default profile, skip
        return

    try:
        hook_data = json.loads(sys.stdin.read())
        tool_name = hook_data.get("tool_name", "?")
        transcript_path = hook_data.get("transcript_path", "")
    except Exception:
        return

    if not os.path.exists(CTX_FILE):
        return

    try:
        with open(CTX_FILE) as f:
            ctx = json.load(f)
    except Exception:
        return

    # Only update if this session matches the one that created the ctx
    ctx_session = ctx.get("session_id", "")
    if ctx_session and transcript_path:
        cur_session = os.path.basename(transcript_path).replace(".jsonl", "")
        if cur_session != ctx_session:
            return

    # Ignore stale ctx older than 5 minutes
    created_at = ctx.get("created_at", 0)
    if created_at and (time.time() - created_at) > 300:
        return

    chat_id = ctx.get("chat_id")
    message_id = ctx.get("message_id")
    tools = ctx.get("tools", [])
    if not chat_id or not message_id:
        return

    if tool_name not in tools:
        tools.append(tool_name)
        ctx["tools"] = tools
        with open(CTX_FILE, "w") as f:
            json.dump(ctx, f)

    tool_line = " → ".join(f"{TOOL_ICONS.get(t,'⚙️')} `{t}`" for t in tools)
    text = f"⏳ **Aio đang xử lý...**\n{tool_line}"

    token = get_token()
    if token:
        edit_message(token, chat_id, message_id, text)

if __name__ == "__main__":
    main()
