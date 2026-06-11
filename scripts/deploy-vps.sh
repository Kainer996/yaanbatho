#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com VPS bootstrap
# ---------------------------------------------------------------
# One-shot, idempotent installer that turns a fresh Ubuntu LTS
# box into a production host for yaanbatho.com (Next.js + the
# Burbz API routes), behind Caddy with auto-Let's Encrypt TLS.
#
# Run as root (or with sudo) on the VPS:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/deploy-vps.sh \
#     | sudo bash
#
# Re-runs are safe: every step checks state first.
# ===============================================================

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Kainer996/yaanbatho.git}"
APP_USER="${APP_USER:-yaanbatho}"
APP_DIR="${APP_DIR:-/opt/yaanbatho}"
APP_PORT="${APP_PORT:-3000}"
DOMAIN_PRIMARY="${DOMAIN_PRIMARY:-yaanbatho.com}"
DOMAIN_WWW="${DOMAIN_WWW:-www.yaanbatho.com}"
NODE_MAJOR="${NODE_MAJOR:-20}"
ENV_FILE="/etc/yaanbatho.env"

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m!! \033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Please run as root (use sudo)."

# ----------------------------------------------------------------
# 1. System packages
# ----------------------------------------------------------------
log "Updating apt and installing base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y -q
apt-get install -y -q curl ca-certificates gnupg git ufw debian-keyring debian-archive-keyring apt-transport-https >/dev/null

# ----------------------------------------------------------------
# 2. Node.js (NodeSource)
# ----------------------------------------------------------------
if ! command -v node >/dev/null 2>&1 || [[ "$(node -v 2>/dev/null | cut -c2- | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
    log "Installing Node.js ${NODE_MAJOR}.x from NodeSource"
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y -q nodejs >/dev/null
fi
log "Node $(node -v), npm $(npm -v)"

# ----------------------------------------------------------------
# 3. Caddy (reverse proxy + automatic TLS)
# ----------------------------------------------------------------
if ! command -v caddy >/dev/null 2>&1; then
    log "Installing Caddy"
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
        | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
        | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
    apt-get update -y -q
    apt-get install -y -q caddy >/dev/null
fi
log "Caddy $(caddy version | head -1)"

# ----------------------------------------------------------------
# 4. App user
# ----------------------------------------------------------------
if ! id -u "$APP_USER" >/dev/null 2>&1; then
    log "Creating system user '$APP_USER'"
    useradd --system --shell /usr/sbin/nologin --home "$APP_DIR" --create-home "$APP_USER"
fi

# ----------------------------------------------------------------
# 5. Source code
# ----------------------------------------------------------------
if [[ ! -d "$APP_DIR/.git" ]]; then
    log "Cloning repo into $APP_DIR"
    rm -rf "$APP_DIR" 2>/dev/null || true
    sudo -u "$APP_USER" git clone --depth 1 "$REPO_URL" "$APP_DIR"
else
    log "Updating repo in $APP_DIR"
    sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth 1 origin main
    sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
fi

# ----------------------------------------------------------------
# 6. Build
# ----------------------------------------------------------------
log "Installing npm dependencies (this can take a minute)"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm ci --no-audit --no-fund"

log "Building Next.js"
sudo -u "$APP_USER" bash -c "cd '$APP_DIR' && npm run build"

# ----------------------------------------------------------------
# 7. Env file
# ----------------------------------------------------------------
if [[ ! -f "$ENV_FILE" ]]; then
    log "Creating $ENV_FILE (root-owned, 0600). Edit to add ANTHROPIC_API_KEY."
    cat > "$ENV_FILE" <<EOF
# yaanbatho.com runtime environment.
# Edit this file then: systemctl restart yaanbatho
NODE_ENV=production
PORT=${APP_PORT}
HOSTNAME=127.0.0.1
# Required for /api/identify-sound (Burbz auto-ID via Claude vision)
ANTHROPIC_API_KEY=
# Optional: token used by /api/upload
UPLOAD_TOKEN=$(openssl rand -hex 16 2>/dev/null || echo "change-me")
EOF
    chmod 0600 "$ENV_FILE"
    chown root:root "$ENV_FILE"
else
    log "$ENV_FILE already present, leaving it alone"
fi

# ----------------------------------------------------------------
# 8. systemd unit
# ----------------------------------------------------------------
UNIT_FILE=/etc/systemd/system/yaanbatho.service
log "Writing $UNIT_FILE"
cat > "$UNIT_FILE" <<EOF
[Unit]
Description=yaanbatho.com (Next.js)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=${APP_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable yaanbatho.service >/dev/null
systemctl restart yaanbatho.service
sleep 2
systemctl --no-pager --lines=10 status yaanbatho.service || true

# ----------------------------------------------------------------
# 9. Caddyfile
# ----------------------------------------------------------------
log "Writing /etc/caddy/Caddyfile"
cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN_PRIMARY}, ${DOMAIN_WWW} {
    encode zstd gzip
    reverse_proxy 127.0.0.1:${APP_PORT}
    log {
        output file /var/log/caddy/yaanbatho-access.log
    }
}
EOF
mkdir -p /var/log/caddy
chown -R caddy:caddy /var/log/caddy
systemctl reload caddy 2>/dev/null || systemctl restart caddy

# ----------------------------------------------------------------
# 10. Firewall
# ----------------------------------------------------------------
log "Configuring ufw (allow 22, 80, 443)"
ufw allow 22/tcp >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
yes | ufw enable >/dev/null

# ----------------------------------------------------------------
# 11. Summary
# ----------------------------------------------------------------
PUB_IP=$(curl -fsS -m 5 https://api.ipify.org 2>/dev/null || echo "<unknown>")
cat <<EOF

\033[1;32m=================================================================\033[0m
\033[1;32m  yaanbatho.com bootstrap complete\033[0m
\033[1;32m=================================================================\033[0m

  App user        : ${APP_USER}
  App dir         : ${APP_DIR}
  App port        : ${APP_PORT} (proxied by Caddy)
  Env file        : ${ENV_FILE}
  Service         : yaanbatho.service  (systemctl status yaanbatho)
  Reverse proxy   : Caddy (auto Let's Encrypt for ${DOMAIN_PRIMARY})

  This server's public IP : ${PUB_IP}

\033[1;33mNext steps:\033[0m

  1) Edit the env file and paste your real Anthropic key:
        sudo nano ${ENV_FILE}
        sudo systemctl restart yaanbatho

  2) Update DNS at your registrar:
        ${DOMAIN_PRIMARY}     A     ${PUB_IP}
        ${DOMAIN_WWW}         A     ${PUB_IP}
     (or CNAME www -> ${DOMAIN_PRIMARY})

  3) Wait a few minutes, then verify from anywhere:
        curl -I https://${DOMAIN_PRIMARY}/
        curl -I https://${DOMAIN_PRIMARY}/burbz/

  4) Once propagation is good, delete the Vercel project.

\033[1;33mUseful commands:\033[0m
   journalctl -u yaanbatho -f      # tail app logs
   journalctl -u caddy -f          # tail proxy logs
   sudo systemctl restart yaanbatho

EOF
