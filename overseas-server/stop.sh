#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .subflux.pid ]; then
  echo "没有运行中的 SubFlux（缺少 .subflux.pid）"
  exit 0
fi
pid="$(cat .subflux.pid)"
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  echo "已停止 SubFlux (PID $pid)"
else
  echo "PID $pid 不存在"
fi
rm -f .subflux.pid
