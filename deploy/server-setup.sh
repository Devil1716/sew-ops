#!/usr/bin/env bash
# Sew Ops: one-time server preparation. Run as root (or with sudo) on a fresh Ubuntu 24.04 server:
#   DOMAIN=app.example.com bash server-setup.sh
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then echo "Run as root: sudo DOMAIN=... bash $0"; exit 1; fi
: "${DOMAIN:?Set DOMAIN, for example: DOMAIN=app.example.com bash server-setup.sh}"
if ! printf '%s' "$DOMAIN" | grep -Eq '^[A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?$'; then
  echo "DOMAIN looks wrong: $DOMAIN"; exit 1
fi

APP=/opt/sewops
log() { printf '\n== %s ==\n' "$*"; }

log "1/9 Updating the system"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get upgrade -y
apt-get install -y ca-certificates curl ufw fail2ban unattended-upgrades cron rclone openssl

log "2/9 Installing Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker
docker compose version

log "3/9 Swap file (small servers need it for safety)"
if [ "$(swapon --show --noheadings | wc -l)" -eq 0 ]; then
  mem_mb=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
  if [ "$mem_mb" -lt 4096 ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  fi
fi

log "4/9 The deploy user"
if ! id deploy >/dev/null 2>&1; then
  adduser --disabled-password --gecos "" deploy
fi
usermod -aG docker deploy
install -d -m 700 -o deploy -g deploy /home/deploy/.ssh
SRC_KEYS=/root/.ssh/authorized_keys
if [ -n "${SUDO_USER:-}" ] && [ "$SUDO_USER" != "root" ]; then
  SRC_KEYS="$(getent passwd "$SUDO_USER" | cut -d: -f6)/.ssh/authorized_keys"
fi
touch /home/deploy/.ssh/authorized_keys
if [ -s "$SRC_KEYS" ]; then
  cat "$SRC_KEYS" >> /home/deploy/.ssh/authorized_keys
  sort -u -o /home/deploy/.ssh/authorized_keys /home/deploy/.ssh/authorized_keys
fi
chown deploy:deploy /home/deploy/.ssh/authorized_keys
chmod 600 /home/deploy/.ssh/authorized_keys
KEYS_OK=0
if [ -s /home/deploy/.ssh/authorized_keys ]; then KEYS_OK=1; fi

log "5/9 App folders"
install -d -o deploy -g deploy -m 755 "$APP" "$APP/scripts" "$APP/backups" "$APP/releases"

log "6/9 Settings file with fresh random secrets"
if [ ! -f "$APP/.env" ]; then
  (
    umask 077
    {
      echo "POSTGRES_USER=sewops"
      echo "POSTGRES_PASSWORD=$(openssl rand -hex 24)"
      echo "POSTGRES_DB=sewops"
      echo "JWT_ACCESS_SECRET=$(openssl rand -hex 48)"
      echo "SITE_ADDRESS=$DOMAIN"
      echo "PUBLIC_ORIGIN=https://$DOMAIN"
      echo "HTTP_PORT=80"
      echo "HTTPS_PORT=443"
      echo "ALLOW_LOCALHOST_ORIGIN=false"
      echo "# Optional off-server backups: an rclone remote and folder, for example r2:sewops-backups"
      echo "BACKUP_REMOTE="
    } > "$APP/.env"
  )
  chown deploy:deploy "$APP/.env"
  chmod 600 "$APP/.env"
  echo "created $APP/.env (the secrets are random and never leave this server)"
else
  echo "$APP/.env already exists: left untouched"
fi

log "7/9 Firewall (only SSH, HTTP and HTTPS are open)"
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

log "8/9 Automatic security updates, brute-force protection, nightly backups"
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
EOF
systemctl enable --now fail2ban
cat > /etc/cron.d/sewops-backup <<'EOF'
15 2 * * * deploy /opt/sewops/scripts/backup.sh >> /opt/sewops/backups/backup.log 2>&1
EOF
chmod 644 /etc/cron.d/sewops-backup

log "9/9 SSH hardening (keys only, no passwords)"
if [ "$KEYS_OK" -eq 1 ]; then
  cat > /etc/ssh/sshd_config.d/99-sewops.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
EOF
  sshd -t
  systemctl reload ssh 2>/dev/null || systemctl reload sshd
else
  echo "WARNING: no SSH key was found for the deploy user, so password login was left ON."
fi

echo
echo "SERVER IS READY."
echo "Domain: $DOMAIN   App folder: $APP"
echo "Next: make sure DNS for $DOMAIN points to this server, then deploy from GitHub."