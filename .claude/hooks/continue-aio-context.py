#!/usr/bin/env python3
"""UserPromptSubmit hook — auto-run scripts/aio-context.sh on the
"continue building Aio" trigger phrase (see CLAUDE.md "Start Here").
Runs the script itself and injects its real stdout, so the model reads the
actual live state instead of needing to remember to invoke the script.
"""
import json
import re
import subprocess
import sys

REPO_ROOT = "/home/swegon/AI_Agent/Aio_project"


def main():
    try:
        hook_data = json.loads(sys.stdin.read())
    except Exception:
        return

    prompt = hook_data.get("prompt", "")
    if not re.search(r"continue building aio", prompt, re.IGNORECASE):
        return

    result = subprocess.run(
        ["bash", "scripts/aio-context.sh"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        timeout=30,
    )
    output = result.stdout.strip() or result.stderr.strip()
    print(f"AIO_CONTEXT (auto-run by hook, scripts/aio-context.sh):\n{output}")


if __name__ == "__main__":
    main()
