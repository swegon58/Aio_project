# Hermes-Agent Startup for Aio Profile

## Problem
Current hermes-agent process (PID 292020) is running WITHOUT the aio profile flags:
```
/home/swegon/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run
```

This means it's using a default profile instead of the aio profile at `apps/harness/aio-home/profiles/aio/`.

The aio profile has `terminal` tool enabled in `hermes-api-server` toolset (config.yaml), but the running process doesn't have this tool available because it's not loading the correct profile.

## Solution
Restart hermes-agent with the correct profile flags:

```bash
cd /home/swegon/AI_Agent/Aio_project/apps/harness

# Kill the current process
kill 292020

# Start with correct profile
HERMES_HOME=aio-home hermes -p aio gateway run &
```

Or for production with logging:
```bash
HERMES_HOME=aio-home hermes -p aio gateway run > /tmp/aio-hermes.log 2>&1 &
```

## Verification
Check that the process started correctly:
```bash
ps aux | grep "hermes.*aio"
```

Should show:
```
hermes_cli.main -p aio gateway run
```

Test that terminal tool is available:
```bash
curl http://127.0.0.1:8642/v1/toolsets
```

Should include `"terminal"` in the tool list.

## Why This Matters
The showcase cards feature (code_exec) requires the write_file → terminal pattern:
1. Backend detects write_file tool call → emits task.codeexec "running"
2. Backend detects terminal tool call → emits task.codeexec "completed"/"error"
3. Frontend displays chip with results from CSV output

Without the terminal tool, step 2 never completes, so no showcase chip appears.

## Profile Structure
```
apps/harness/
├── aio-home/
│   ├── profiles/
│   │   └── aio/
│   │       ├── config.yaml      # ← terminal tool enabled here
│   │       ├── .env             # API keys, credentials
│   │       └── workspace/       # Working directory
```

The `config.yaml` has:
```yaml
platform_toolsets:
  api_server:
    - hermes-api-server  # ← includes terminal tool
    - clarify
```

And `hermes-api-server` toolset (in hermes-agent/toolsets.py:390) includes:
- `terminal` (line 396)
- `write_file` (line 398)
- All other tools needed for code_exec pattern
