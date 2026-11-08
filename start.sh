#!/bin/sh
set -eu
cd "$(dirname "$0")"
mkdir -p data
chmod +x bin/mihomo 2>/dev/null || true
if [ -f .subflux.pid ] && kill -0 "$(cat .subflux.pid)" 2>/dev/null; then
  echo "SubFlux 已在运行 (PID $(cat .subflux.pid))"
  exit 0
fi
setsid nohup node --max-old-space-size=256 server.js >> server.log 2>&1 < /dev/null &
echo $! > .subflux.pid
echo "SubFlux 已启动: http://0.0.0.0:${PORT:-8888} (PID $!)"
