#!/usr/bin/env bash
# Показать сайт в интернете со своего компьютера — по одной ссылке https://….trycloudflare.com
# (Cloudflare Tunnel, бесплатно, без регистрации). Работает, пока открыт этот терминал.
#
#   ./scripts/share.sh          остановить — Ctrl+C
#
# Запускает свой API (порт 8011, та же база из .env) и собранный сайт (порт 4173);
# ваш обычный API на 8001 и сайт на 5173 не трогает. Django-админка по ссылке не открывается —
# она остаётся на этом компьютере: http://localhost:8002/admin/
set -euo pipefail

cd "$(dirname "$0")/.."
API_PORT=8011
WEB_PORT=4173
LOG_DIR="$(mktemp -d)"
CLOUDFLARED="$(command -v cloudflared || echo "$HOME/.local/bin/cloudflared")"

if [ ! -x "$CLOUDFLARED" ]; then
  echo "Скачиваю cloudflared в ~/.local/bin…"
  mkdir -p "$HOME/.local/bin"
  curl -sL -o "$HOME/.local/bin/cloudflared" \
    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
  chmod +x "$HOME/.local/bin/cloudflared"
  CLOUDFLARED="$HOME/.local/bin/cloudflared"
fi

for port in $API_PORT $WEB_PORT; do
  if ss -ltn | grep -q ":$port "; then
    echo "Порт $port занят — возможно, share.sh уже запущен в другом терминале." >&2
    exit 1
  fi
done

pids=()
cleanup() {
  echo
  echo "Останавливаю…"
  kill "${pids[@]}" 2>/dev/null || true
  wait 2>/dev/null || true
  rm -rf "$LOG_DIR"
}
trap cleanup EXIT INT TERM

echo "1/4 Туннель Cloudflare…"
"$CLOUDFLARED" tunnel --no-autoupdate --url "http://localhost:$WEB_PORT" >"$LOG_DIR/tunnel.log" 2>&1 &
pids+=($!)
URL=""
for _ in $(seq 60); do
  URL="$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" | head -1 || true)"
  [ -n "$URL" ] && break
  sleep 1
done
if [ -z "$URL" ]; then
  echo "Не удалось получить ссылку от Cloudflare. Лог:" >&2
  cat "$LOG_DIR/tunnel.log" >&2
  exit 1
fi

echo "2/4 Сборка сайта…"
(cd frontend && VITE_API_BASE_URL=/api/v1 npx vite build --logLevel error)

echo "3/4 API на порту $API_PORT…"
# ссылка туннеля — для писем о сбросе пароля; 127.0.0.1 (сайт-прокси) — доверенный: лимиты по IP посетителя
FRONTEND_URL="$URL" TRUSTED_PROXIES='["127.0.0.1"]' \
  uv run uvicorn app.main:app --host 127.0.0.1 --port "$API_PORT" >"$LOG_DIR/api.log" 2>&1 &
pids+=($!)

echo "4/4 Сайт на порту $WEB_PORT…"
(cd frontend && BANDUP_API="http://127.0.0.1:$API_PORT" \
  npx vite preview --host 127.0.0.1 --port "$WEB_PORT" --strictPort >"$LOG_DIR/web.log" 2>&1) &
pids+=($!)

for _ in $(seq 30); do
  curl -s -o /dev/null "http://127.0.0.1:$API_PORT/api/v1/site/landing" &&
    curl -s -o /dev/null "http://127.0.0.1:$WEB_PORT/" && break
  sleep 1
done

cat <<EOF

  Сайт открыт в интернете:  $URL

  • откройте ссылку на телефоне или отправьте её — работает везде, где есть интернет
  • ссылка работает, пока открыт этот терминал; при следующем запуске она будет другой
  • остановить — Ctrl+C

EOF
wait
