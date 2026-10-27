#!/bin/bash
# run-tro-full.sh — Detached full storyboard+film run for "Tro và Bánh Chưng".
# RULE (Nắng 2026-07-03): ONE Flow project per film, named after the film ("Tro và Bánh Chưng").
#   All 30 keyframes (free Nano Banana 9:16) + 30 Veo clips live in that single project. No project spam.
# v0.8: free Flow Omni image keyframes + Veo video, anti-hallucination gates. Survives exec teardown.
set -u
cd /root/.openclaw/workspace/AUTOMATION-LABGOOGLE
export LABGOOGLE_PROFILE='/root/.openclaw/workspace/google-flow-vps-profile-v2'
# v0.9: reuse the warm keeper Chrome over CDP (no per-shot chromium cold-start).
export LABGOOGLE_CDP='http://127.0.0.1:18899'
OUTDIR="out"
FILM="Tro và Bánh Chưng"
LOG="$OUTDIR/tro-run.log"

echo "=== START $(date -u +%FT%TZ) film=$FILM ===" >> "$LOG"
rm -f "$LABGOOGLE_PROFILE"/Singleton* 2>/dev/null

BRIEF='Tro va Banh Chung: A heartwarming 5-minute Vietnamese Lunar New Year (Tet) short film. A 6-year-old boy named Tro learns to wrap his first banh chung with his grandmother, fails and cries, she teaches him hand-over-hand, he succeeds with a crooked little cake and proudly gifts it to her on New Year morning. Warm cinematic realism, 35mm, amber-and-jade grade, Vietnamese countryside, gentle emotional, Vietnamese dialogue, SFX ambience, no background music.'

# --film-name sets the single Flow project name = film title (rule: 1 project per film).
# storyboard.fallback.json is pre-seeded in the film dir so it skips the broken NLM step.
timeout 14400 xvfb-run -a npx tsx scripts/director-master.ts director run \
  --brief "$BRIEF" \
  --film-name "$FILM" \
  --minutes 5 --no-music --vocal vi \
  --out "$OUTDIR" --json >> "$LOG" 2>&1

echo "=== END $(date -u +%FT%TZ) exit=$? ===" >> "$LOG"
