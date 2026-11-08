#!/bin/sh
set -eu
cd "$(dirname "$0")"
if [ ! -f .subflux.pid ]; then
  echo "没有 .subflux.pid，尝试按 8888 端口停止"
  exec sh /data/dsh/tools/bin/stop-serve.sh
fi
pid="$(cat .subflux.pid)"
if kill -0 "$pid" 2>/dev/null; then
  kill "$pid"
  echo "已停止 SubFlux (PID $pid)"
else
  echo "PID $pid 不存在"
fi
rm -f .subflux.pid
