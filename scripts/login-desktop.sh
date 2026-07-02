#!/usr/bin/env bash
# Dựng desktop VNC tạm cho anh Nấng login Google tận tay qua Tailscale.
# KHÔNG chứa password. Chrome mở trên chính profile v2 để cookie login lưu đúng chỗ CLI dùng.
set -e
export DISPLAY=:77
PROFILE="/root/.openclaw/workspace/google-flow-vps-profile-v2"
CHROME="/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome"

pkill -f 'Xvfb :77' 2>/dev/null || true
pkill -f 'x11vnc.*:77' 2>/dev/null || true
pkill -f 'websockify.*6080' 2>/dev/null || true
sleep 1

Xvfb :77 -screen 0 1440x900x24 >/tmp/xvfb77.log 2>&1 &
sleep 2

"$CHROME" \
  --user-data-dir="$PROFILE" \
  --no-first-run --no-default-browser-check \
  --no-sandbox --disable-dev-shm-usage \
  --disable-blink-features=AutomationControlled \
  --window-size=1440,900 \
  "https://accounts.google.com/ServiceLogin?continue=https://labs.google/fx/tools/flow" \
  >/tmp/chrome77.log 2>&1 &
sleep 3

# VNC server (no password on VNC itself; access gated by Tailscale private network)
x11vnc -display :77 -forever -shared -nopw -rfbport 5900 -bg >/tmp/x11vnc77.log 2>&1
sleep 1

# noVNC websocket bridge on 0.0.0.0:6080 (reachable via Tailscale IP)
websockify --web=/usr/share/novnc 6080 localhost:5900 >/tmp/novnc77.log 2>&1 &
sleep 2
echo "READY"
echo "Tailscale URL: http://100.65.135.62:6080/vnc.html"
ss -ltnp 2>/dev/null | grep -E ':6080|:5900' || netstat -ltnp 2>/dev/null | grep -E ':6080|:5900'
