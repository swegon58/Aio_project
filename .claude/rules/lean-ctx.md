# lean-ctx — Mandatory in this project

Always use:
- `ctx_read` not Read/cat/head/tail
- `ctx_shell` not Bash (95+ compression patterns)
- `ctx_search` not Grep/rg
- `ctx_tree` not ls/find
- Native Edit/Write stay as-is — lean-ctx is read-only.

Default `ctx_read(path, "auto")` first; native `Read`/full mode only right before an `Edit` needing literal content.
