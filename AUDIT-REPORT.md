# AUTOMATION-LABGOOGLE Audit Report

Audit time: 2026-07-02 CEST

## Summary

| # | Goal | Result | Proof |
|---|---|---|---|
| 1 | Fix Flow render-poll | PASS (code), FAIL (E2E blocked) | `scripts/labgoogle.ts`; `out/audit-flow-2.json`; `out/flow-composer-1782951248039.png` |
| 2 | Fix Flow download | PASS (code), FAIL (no real video downloaded) | code has UI download + source fetch fallback; blocked before composer/render |
| 3 | Wire `music gen` | PARTIAL/FAIL | `out/audit-music.json`; `out/music-open-1782951134124.png`; no audio file |
| 4 | Wire `notebooklm` basic list | PARTIAL/FAIL | `out/audit-notebooklm.json`; `out/notebooklm-1782951171139.png` |
| 5 | Full E2E audit | FAIL | `whoami` passed; Flow/Music/NotebookLM UI blocked by account chooser |
| 6 | Update README | PASS | `README.md` |
| 7 | Write audit report | PASS | this file |

## What changed

- Fixed Flow render detection bug. The previous expression treated blob URLs incorrectly:
  `!s.startsWith('blob:') === false || ...`
- New polling checks `<video>` `currentSrc/src/src` and accepts `http`, `blob`, or `data` sources.
- Poll timeout defaults to 600000 ms (10 min), interval ~9 s, with screenshots at submit, periodic poll, and final done.
- Added download path:
  1. Try visible Download UI/menu item.
  2. Fallback fetch `http` media via Playwright request.
  3. Fallback fetch `blob:`/`data:` in page and save bytes.
  4. Run `file` command and include size/magic in JSON.
- Added `music gen` submit/poll/download skeleton with MusicFX first and Flow fallback.
- Added `notebooklm --json` basic open/list/screenshot command.
- Added account-chooser click attempt in `getSession`, but current state still shows account chooser with accounts signed out.

## E2E command results

### whoami

Command:

```bash
./AUTOMATION-LABGOOGLE/bin/labgoogle whoami --json
```

Result: PASS

Proof JSON: `out/audit-whoami.json`

Output showed:

```json
{"signedIn":true,"account":"m***@gmail.com","plan":"unknown"}
```

### Flow gen full render + download

Command:

```bash
./AUTOMATION-LABGOOGLE/bin/labgoogle flow gen --prompt "A tiny robot waves in a sunny lab, 2 seconds, simple." --submit --timeout 600000 --json
```

Result: FAIL / BLOCKED

Proof JSON: `out/audit-flow-2.json`
Proof screenshot: `out/flow-composer-1782951248039.png`

Observed stage: `composer-open-no-field`.
Screenshot shows Google account chooser, with the target account marked `Signed out`; therefore composer was not reachable and no render/download could occur.

Downloaded video: none.

### Music gen

Command:

```bash
./AUTOMATION-LABGOOGLE/bin/labgoogle music gen --prompt "short upbeat synth loop" --timeout 180000 --json
```

Result: FAIL / BLOCKED

Proof JSON: `out/audit-music.json`
Proof screenshots:
- `out/music-open-1782951134124.png`
- `out/music-typed-1782951148587.png`

Observed stage: `composer-open-no-field`; fallback was attempted. No audio rendered or downloaded.

Downloaded audio: none.

### NotebookLM

Command:

```bash
./AUTOMATION-LABGOOGLE/bin/labgoogle notebooklm --json
```

Result: PARTIAL / BLOCKED

Proof JSON: `out/audit-notebooklm.json`
Proof screenshot: `out/notebooklm-1782951171139.png`

NotebookLM opened but redirected to Google account chooser. The page listed stored accounts and sign-in UI controls, not notebooks.

## Blocker

The real blocker is UI authentication: the Labs session endpoint still reports signed-in, but browser UI for Flow and NotebookLM now lands on `accounts.google.com` account chooser with the Google accounts marked `Signed out`. Per rule, I did not logout, delete cookies, or brute-force login. Manual re-auth / cookie refresh is required before a true Flow video or Music audio render/download audit can pass.

## Real media files

- Video: none (blocked before render)
- Audio: none (blocked before composer/render)

---

# Scope-update audit (02:14 CEST additions) — 2026-07-02 ~02:25 CEST

## NotebookLM FULL suite (new)

Wired commands (all with JSON + screenshot proofs):

- `notebooklm list [--json]`
- `notebooklm create --title "..."`
- `notebooklm source add --notebook <id|title> (--url | --text | --file)`
- `notebooklm chat --notebook ... --prompt ... [--preset NAME | --system-file PATH]`
- `notebooklm audio-overview --notebook ... [--prompt ...]` — trigger Studio Audio Overview, poll, download audio
- `presets/` created with `podcast-script.txt` and `seeding-content.txt`

### E2E results

| Command | Result | Proof |
|---|---|---|
| `notebooklm list` | BLOCKED (`blocked-auth-wall`) | `out/audit-nlm-list.json`, `out/nlm-list-1782951612511.png` |
| `notebooklm create` | BLOCKED (`blocked-auth-wall`) | `out/audit-nlm-create.json`, `out/nlm-create-1782951666002.png` |
| `notebooklm chat --preset podcast-script` | BLOCKED (`blocked-auth-wall`) | `out/audit-nlm-chat.json`, `out/nlm-chat-1782951701702.png` |
| `notebooklm audio-overview` | BLOCKED (`blocked-auth-wall`) | `out/audit-nlm-audio.json`, `out/nlm-audio-1782951731870.png` |

NotebookLM now redirects to `accounts.google.com/v3/signin/rejected` — Google actively rejects the passive re-auth for NotebookLM even though the Labs FX cookie session still answers signed-in (`out/audit-whoami-2.json`). No brute-force attempted per policy. **Real fix required: refresh Google session cookies into the VPS profile from a live signed-in browser.**

## Security sanitization (pre-release)

- Removed hardcoded personal email from `labgoogle.ts` and `keepalive.ts`; replaced with `LABGOOGLE_ACCOUNT` env hint + generic `"email":` JSON check.
- `.gitignore` blocks: `google-flow-vps-profile/`, `*storage-state.json`, `cookies*`, `out/`, all media/screenshots, `.env`, keys.
- Grep gate over shipped files (`*.ts, *.md, *.json, *.txt` excluding `out/`): CLEAN — no personal email, no cookies/tokens.
- README uses `YOUR_ACCOUNT` placeholder.

## GitHub release

See section appended below after push attempt.
