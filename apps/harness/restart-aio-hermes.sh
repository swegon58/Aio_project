#!/bin/bash
# Restart hermes-agent with aio profile

echo "Killing old process (PID 292020)..."
kill 292020
sleep 2

echo "Starting hermes-agent with aio profile..."
cd /home/swegon/AI_Agent/Aio_project/apps/harness
HERMES_HOME=aio-home hermes -p aio gateway run > /tmp/aio-hermes.log 2>&1 &
NEW_PID=$!

echo "Waiting for startup..."
sleep 3

echo "Verifying new process..."
ps aux | grep "hermes.*aio" | grep -v grep

echo ""
echo "Testing terminal tool availability..."
sleep 2
curl -s http://127.0.0.1:8642/v1/toolsets | grep -o '"terminal"' && echo "✓ Terminal tool available!" || echo "✗ Terminal tool NOT found"

echo ""
echo "Done! New PID: $NEW_PID"
echo "Log file: /tmp/aio-hermes.log"
