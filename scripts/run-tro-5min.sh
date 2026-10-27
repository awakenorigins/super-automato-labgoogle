#!/usr/bin/env bash
# run-tro-5min.sh — chạy + retry director render phim Tro 5 phút
# Storyboard-first: đọc storyboard.fallback.json sẵn có trong out dir
# Retry 6 lần, checkpoint resume mỗi shot

set -euo pipefail

BASE="/root/.openclaw/workspace/AUTOMATION-LABGOOGLE"
LOG="$BASE/out/render-5min.log"
BRIEF="Phim điện ảnh 5 phút - câu bé tro và chiếc bàn"
PROJECT="Automato-Film-Tro"
MAX_RETRY=6

mkdir -p "$BASE/out"

run_once() {
  local attempt=$1
  echo "[run-tro] Attempt $attempt / $MAX_RETRY — $(date)" | tee -a "$LOG"
  cd /root/.openclaw/workspace
  npx tsx "$BASE/scripts/director-master.ts" \
    --brief "$BRIEF" \
    --project "$PROJECT" \
    --minutes 5 \
    --no-music \
    --vocal vi \
    --out "$BASE/out" \
    --json 2>&1 | tee -a "$LOG"
}

attempt=0
while [ $attempt -lt $MAX_RETRY ]; do
  attempt=$((attempt + 1))
  if run_once "$attempt"; then
    echo "[run-tro] director exited 0 on attempt $attempt — checking for film-final.mp4" | tee -a "$LOG"
    FINAL="$BASE/out/master-phim-i-n-nh-5-ph-t-c-u-b-tro-v-chi-c-b-n/film-final.mp4"
    if [ -f "$FINAL" ] && [ -s "$FINAL" ]; then
      echo "[run-tro] SUCCESS: $FINAL" | tee -a "$LOG"
      exit 0
    else
      echo "[run-tro] exited 0 but no film-final.mp4 — retrying..." | tee -a "$LOG"
    fi
  else
    EC=$?
    echo "[run-tro] director exited $EC on attempt $attempt — retrying in 10s..." | tee -a "$LOG"
    sleep 10
  fi
done

echo "[run-tro] FAILED after $MAX_RETRY attempts" | tee -a "$LOG"
exit 1
