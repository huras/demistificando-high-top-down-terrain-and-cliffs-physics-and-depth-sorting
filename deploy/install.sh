#!/usr/bin/env bash
set -euo pipefail

# Instala SOMENTE o site 3D. Não mexe em pokemon-ai, pkmnow-demo nem index.
APP_DIR="/var/www/pokemon-wild-cry-3d"
REF_DIR="/var/www/pokemon-ai"
REPO="${DEPLOY_REPO:-https://github.com/huras/demistificando-high-top-down-terrain-and-cliffs-physics-and-depth-sorting.git}"
BRANCH="${1:-main}"
SKIP_GIT="${SKIP_GIT:-0}"
NGINX_SITE="/etc/nginx/sites-available/pokemon-wild-cry-3d.hurast.com"
PRIMARY_HOST="pokemon-wild-cry-3d.hurast.com"
PM2_NAME="pokemon-wild-cry-3d"

echo "==> Deploying Pokémon Wild Cry 3D → ${PRIMARY_HOST} (branch: ${BRANCH})"

if [ ! -d "$REF_DIR" ]; then
  echo "FAIL: falta ${REF_DIR} (Pokemon AI) — o 3D lê /ref daí"
  exit 1
fi

if [ "$SKIP_GIT" != "1" ]; then
  if [ ! -d "$APP_DIR/.git" ]; then
    git clone --branch "$BRANCH" "$REPO" "$APP_DIR"
  else
    cd "$APP_DIR"
    git remote set-url origin "$REPO" 2>/dev/null || true
    git fetch origin
    git checkout "$BRANCH"
    echo "==> Syncing VPS to origin/${BRANCH}..."
    git reset --hard "origin/${BRANCH}"
  fi
else
  echo "==> SKIP_GIT=1 — mantendo arquivos já sincronizados no VPS"
  mkdir -p "$APP_DIR"
fi

cd "$APP_DIR"

if [ ! -f servidor.mjs ] || [ ! -f deploy/nginx-pokemon-wild-cry-3d.hurast.com.conf ]; then
  echo "FAIL: arquivos do app 3D incompletos em ${APP_DIR}"
  exit 1
fi

npm install --omit=dev

mkdir -p .cache/pmd-atlas/v9

cp deploy/nginx-pokemon-wild-cry-3d.hurast.com.conf "$NGINX_SITE"
ln -sf "$NGINX_SITE" /etc/nginx/sites-enabled/pokemon-wild-cry-3d.hurast.com

# TLS: HTTP temporário só deste host se o cert ainda não existe.
if [ ! -f "/etc/letsencrypt/live/${PRIMARY_HOST}/fullchain.pem" ]; then
  echo "==> TLS ainda não emitido — config HTTP temporária para ACME..."
  cat > "$NGINX_SITE" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${PRIMARY_HOST};
    root ${APP_DIR};
    location / { try_files \$uri \$uri/ =404; }
}
EOF
  nginx -t
  systemctl reload nginx

  echo "==> Requesting TLS certificate (certbot)..."
  certbot certonly --nginx \
    -d "$PRIMARY_HOST" \
    --non-interactive --agree-tos -m admin@hurast.com \
    --cert-name "$PRIMARY_HOST" || true

  cp deploy/nginx-pokemon-wild-cry-3d.hurast.com.conf "$NGINX_SITE"
fi

if [ ! -f "/etc/letsencrypt/live/${PRIMARY_HOST}/fullchain.pem" ]; then
  echo "FAIL: certificado TLS de ${PRIMARY_HOST} não existe."
  echo "    Confirme o DNS A → este VPS e rode de novo o install."
  exit 1
fi

nginx -t
systemctl reload nginx

if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 delete "$PM2_NAME"
fi
pm2 start deploy/ecosystem.config.cjs
pm2 save

echo "==> Done. Game 3D: https://${PRIMARY_HOST}"
echo "    (pokemon-ai / wild-cry 2D NÃO foram alterados)"
