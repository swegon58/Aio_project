#!/usr/bin/env python3
"""Standalone helper: fetch a read-only Honcho memory snapshot for one
session key (the same value Aio sends as X-Hermes-Session-Key, i.e. the
Supabase userId). Prints JSON to stdout. New file — does not modify
hermes-agent core. Run with hermes-agent's venv interpreter and
HERMES_HOME/HOME pointed at the aio profile so HonchoClientConfig resolves
the right honcho.json / .env.

Usage:
    HERMES_HOME=<aio-home> HOME=<aio-home>/profiles/aio/home \
      .venv/bin/python3 memory_summary.py <session_key>
"""
import json
import sys
from pathlib import Path

HERMES_AGENT_ROOT = Path(__file__).resolve().parents[2] / "hermes-agent"
sys.path.insert(0, str(HERMES_AGENT_ROOT))


def main() -> int:
    if len(sys.argv) != 2:
        print(json.dumps({"error": "usage: memory_summary.py <session_key>"}))
        return 1
    session_key = sys.argv[1]

    from hermes_cli.env_loader import load_hermes_dotenv
    from plugins.memory.honcho.client import HonchoClientConfig, get_honcho_client
    from plugins.memory.honcho.session import HonchoSessionManager

    load_hermes_dotenv()

    cfg = HonchoClientConfig.from_global_config()
    if not (cfg.enabled and (cfg.api_key or cfg.base_url)):
        print(json.dumps({"available": False, "reason": "honcho not configured"}))
        return 0

    try:
        client = get_honcho_client(cfg)
        manager = HonchoSessionManager(
            honcho=client,
            config=cfg,
            context_tokens=cfg.context_tokens,
            runtime_user_peer_name=session_key,
        )
        manager.get_or_create(session_key)

        result: dict = {"available": True, "summary": None, "facts": []}

        try:
            ctx = manager.get_session_context(session_key, peer="user")
            summary = (ctx or {}).get("summary")
            if summary and getattr(summary, "content", None):
                result["summary"] = summary.content
        except Exception as e:  # noqa: BLE001 — best-effort, degrade to facts only
            result["summary_error"] = str(e)

        try:
            facts = manager.get_peer_card(session_key, peer="user")
            result["facts"] = list(facts or [])[:10]
        except Exception as e:  # noqa: BLE001
            result["facts_error"] = str(e)

        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as e:  # noqa: BLE001 — surfaced as JSON, not a traceback
        print(json.dumps({"available": False, "error": str(e)}))
        return 0


if __name__ == "__main__":
    raise SystemExit(main())
