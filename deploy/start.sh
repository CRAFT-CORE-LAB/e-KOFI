#!/bin/sh
set -eu

export API_PORT="${API_PORT:-3001}"
export WEB_PORT="${WEB_PORT:-3000}"

cd /app/backend
npx prisma migrate deploy
npx prisma db seed

node dist/src/main.js &
API_PID=$!

cd /app/frontend
while true; do
  npx next start -H 127.0.0.1 -p "$WEB_PORT" || true
  echo "admin web process exited; restarting" >&2
  sleep 2
done &

i=0
until node -e "fetch('http://127.0.0.1:'+process.env.API_PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"; do
  i=$((i + 1))
  if [ "$i" -gt 90 ]; then
    echo "API did not become healthy" >&2
    kill "$API_PID" 2>/dev/null || true
    exit 1
  fi
  sleep 1
done

cd /app
exec node host-router.mjs
