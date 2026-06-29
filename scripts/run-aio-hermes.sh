#!/usr/bin/env bash
set -euo pipefail

USER_HOME="/home/swegon"

export PATH="$USER_HOME/.local/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
export HERMES_HOME="/home/swegon/AI_Agent/Aio_project/apps/harness/aio-home"
export HOME="/home/swegon/AI_Agent/Aio_project/apps/harness/aio-home/profiles/aio/home"

cd /home/swegon/AI_Agent/Aio_project/apps/harness/hermes-agent
exec hermes -p aio gateway run --replace
