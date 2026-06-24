#!/usr/bin/env bash
# UserPromptSubmit hook — spawn aio tmux terminal if not already open.
# Runs async so it doesn't block Claude's response.

# Only run in Discord bot session
[[ "$DISCORD_SESSION" != "1" ]] && exit 0

# Only if tmux session exists
tmux has-session -t aio 2>/dev/null || exit 0

# Don't spawn if already have a client attached
client_count=$(tmux list-clients -t aio 2>/dev/null | wc -l)
[[ "$client_count" -gt 0 ]] && exit 0

# Spawn cosmic-term via systemd-run (inherits user environment with WAYLAND_DISPLAY)
# Background processes on Wayland don't get activation tokens, so window appears
# in taskbar without stealing focus.
systemd-run --user --no-block --collect \
    /usr/bin/cosmic-term -- tmux attach -t aio 2>/dev/null

exit 0
