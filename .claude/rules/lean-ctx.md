# lean-ctx — Mandatory in this project

Always use:
- `ctx_read` not Read/cat/head/tail
- `ctx_shell` not Bash (95+ compression patterns)
- `ctx_search` not Grep/rg
- `ctx_tree` not ls/find
- Native Edit/Write stay as-is — lean-ctx is read-only.

Root cause (traced 2026-06-23 in the original AI_Autonomous_Project location): high context/token usage came from native `Read` calls on large files (e.g. `AppHome.tsx`) instead of `ctx_read`, which compresses heavily. Default to `ctx_read(path, "auto")` first; only fall back to native `Read`/full mode right before an `Edit` that needs literal full content.
