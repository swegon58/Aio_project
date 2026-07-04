#!/usr/bin/env python3
"""PostToolUse hook — scoped eslint on the file just edited.
Only checks apps/web/**/*.ts(x) after Edit/Write, and only prints output
(as a system reminder) when eslint actually finds something, so a clean
edit stays silent.
"""
import json
import subprocess
import sys
from pathlib import Path

WEB_ROOT = Path("/home/swegon/AI_Agent/Aio_project/apps/web")


def main():
    try:
        hook_data = json.loads(sys.stdin.read())
    except Exception:
        return

    if hook_data.get("tool_name") not in ("Edit", "Write"):
        return

    file_path = hook_data.get("tool_input", {}).get("file_path", "")
    if not file_path.endswith((".ts", ".tsx")):
        return

    path = Path(file_path)
    try:
        rel = path.relative_to(WEB_ROOT)
    except ValueError:
        return

    result = subprocess.run(
        ["npx", "eslint", str(rel)],
        cwd=WEB_ROOT,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode == 0 and not result.stdout.strip():
        return

    print(f"POST_EDIT_LINT ({rel}):\n{result.stdout.strip()}")


if __name__ == "__main__":
    main()
