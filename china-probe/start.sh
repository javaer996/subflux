#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ -f .probe.pid ] && kill -0 "$(cat .probe.pid)" 2>/dev/null; then
  echo "探针已在运行 (PID $(cat .probe.pid))"
  exit 0
fi
: "${PROBE_TOKEN:?请先设置 PROBE_TOKEN（至少 16 位）}"
setsid nohup node probe.js >> probe.log 2>&1 < /dev/null &
echo $! > .probe.pid
echo "SubFlux 探针已启动: ${PROBE_HOST:-0.0.0.0}:${PROBE_PORT:-8899} (PID $!)"
