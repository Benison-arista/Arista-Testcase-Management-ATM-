#!/usr/bin/env bash
# deploy.sh — Deploy ATM (no Docker, no nginx) on a Linux host.
#
# Usage:
#   ./deploy.sh          # full deploy / redeploy
#   ./deploy.sh --seed   # same + create admin user (first deploy only)
#
# Requirements: bash, apt-based Linux, Node >= 18
# PostgreSQL and PM2 are installed automatically if missing.

set -euo pipefail

ENV_FILE=".env.prod"
APP_PORT=5173
PG_USER="atm"
PG_DB="atm_db"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --------------------------------------------------------------------------- #
# Helpers                                                                      #
# --------------------------------------------------------------------------- #
log() { echo "==> $*"; }
die() { echo "ERROR: $*" >&2; exit 1; }

[[ $EUID -ne 0 ]] && SUDO="sudo" || SUDO=""

# --------------------------------------------------------------------------- #
# 0. Pre-flight                                                                #
# --------------------------------------------------------------------------- #
[[ -f "$ENV_FILE" ]] || die "$ENV_FILE not found. Copy .env.prod.example and fill in real values."

set -a; source "$ENV_FILE"; set +a

[[ -z "${POSTGRES_PASSWORD:-}" ]] && die "POSTGRES_PASSWORD is not set in $ENV_FILE"
[[ -z "${JWT_SECRET:-}"        ]] && die "JWT_SECRET is not set in $ENV_FILE"
[[ -z "${CORS_ORIGIN:-}"       ]] && die "CORS_ORIGIN is not set in $ENV_FILE"

# --------------------------------------------------------------------------- #
# 1. Install system dependencies                                               #
# --------------------------------------------------------------------------- #
log "Checking system dependencies..."

if ! command -v psql &>/dev/null; then
  log "Installing PostgreSQL..."
  $SUDO apt-get update -qq
  $SUDO apt-get install -y postgresql postgresql-contrib
fi

if ! command -v node &>/dev/null || \
   [[ $(node -e 'process.stdout.write(process.versions.node.split(".")[0])') -lt 18 ]]; then
  log "Installing Node.js 20.x..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | $SUDO bash -
  $SUDO apt-get install -y nodejs
fi

if ! command -v pm2 &>/dev/null; then
  log "Installing PM2..."
  $SUDO npm install -g pm2
fi

# --------------------------------------------------------------------------- #
# 2. PostgreSQL — ensure running, create user/db                              #
# --------------------------------------------------------------------------- #
log "Configuring PostgreSQL..."

$SUDO systemctl enable postgresql
$SUDO systemctl start postgresql

$SUDO -u postgres psql -v ON_ERROR_STOP=0 <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${PG_USER}') THEN
    CREATE ROLE ${PG_USER} LOGIN PASSWORD '${POSTGRES_PASSWORD}';
  ELSE
    ALTER ROLE ${PG_USER} PASSWORD '${POSTGRES_PASSWORD}';
  END IF;
END
\$\$;

SELECT 'CREATE DATABASE ${PG_DB} OWNER ${PG_USER}'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '${PG_DB}')
\gexec
SQL

# --------------------------------------------------------------------------- #
# 3. Frontend build (outputs to backend/public/)                              #
# --------------------------------------------------------------------------- #
log "Building frontend..."
cd "$SCRIPT_DIR/frontend"
npm ci
npm run build

# --------------------------------------------------------------------------- #
# 4. Backend                                                                   #
# --------------------------------------------------------------------------- #
log "Installing backend dependencies..."
cd "$SCRIPT_DIR/backend"
npm ci --omit=dev

# Write runtime .env for the backend
cat > .env <<ENV
DATABASE_URL=postgresql://${PG_USER}:${POSTGRES_PASSWORD}@localhost:5432/${PG_DB}
JWT_SECRET=${JWT_SECRET}
JWT_EXPIRES_IN=${JWT_EXPIRES_IN:-8h}
CORS_ORIGIN=${CORS_ORIGIN}
DB_POOL_MAX=${DB_POOL_MAX:-20}
PORT=${APP_PORT}
ENV

log "Starting backend with PM2 on port ${APP_PORT}..."
pm2 stop atm-backend 2>/dev/null || true
pm2 delete atm-backend 2>/dev/null || true

pm2 start src/index.js \
  --name atm-backend \
  --cwd "$SCRIPT_DIR/backend" \
  --log "$SCRIPT_DIR/backend/pm2.log" \
  --restart-delay 3000 \
  --max-restarts 10

pm2 save

pm2 startup systemd -u "$USER" --hp "$HOME" 2>/dev/null || \
  log "Run the 'pm2 startup' command printed above as root to enable auto-start on reboot."

# --------------------------------------------------------------------------- #
# 5. Seed admin user (first deploy only)                                       #
# --------------------------------------------------------------------------- #
if [[ "${1:-}" == "--seed" ]]; then
  log "Seeding admin user..."
  node scripts/seed-admin.js
fi

# --------------------------------------------------------------------------- #
# Done                                                                         #
# --------------------------------------------------------------------------- #
echo ""
echo "Deployment complete."
echo "  App:   ${CORS_ORIGIN}"
echo "  Logs:  pm2 logs atm-backend"
[[ "${1:-}" == "--seed" ]] && echo "  Login: admin / admin123  (change immediately)"
