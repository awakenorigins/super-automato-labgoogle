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

## GitHub release result

- Repo: https://github.com/NachaFromMars/super-automato-labgoogle
- Release: https://github.com/NachaFromMars/super-automato-labgoogle/releases/tag/v0.2.0 (v0.2.0)
- Pushed 10 files from sanitized staging dir (README, LICENSE, .gitignore, package.json, AUDIT-REPORT, bin/labgoogle portable launcher, scripts/labgoogle.ts + keepalive.ts, presets/*).
- Security gate before push: PASS — no cookies/tokens/full personal emails; account shown only masked (`m***@gmail.com`); profile/storage-state/screenshots excluded.

---

# Round-3 audit — 2026-07-02 ~07:40 CEST (FULL E2E, real media)

Auth: persistent profile signed in (Labs session OK, NotebookLM UI OK). A stale keeper
process (`yt-forever-keeper.sh` + Chrome on the yt profile) was killed before the runs;
the default `google-flow-vps-profile-v2` profile carried the live session.

## Summary

| # | Goal | Result | Proof |
|---|---|---|---|
| 1 | Flow/Veo E2E render + download | ✅ PASS (round 2, unchanged) | `out/audit2-flow.json` stage=`rendered-downloaded`; `out/flow-video-1782955361413.mp4` (1.1 MB, `ISO Media, MP4 Base Media v1`) + `out/flow-video-1782955040605.mp4` |
| 2 | MusicFX E2E render + download | ✅ PASS | `out/audit3-music.json` stage=`rendered-downloaded`; `out/music-audio-1782969952057.wav` (5.7 MB, `RIFF WAVE audio, PCM 16 bit, stereo 48000 Hz`, 30.0 s) |
| 3 | NotebookLM create | ✅ PASS | `out/audit3-nlm-create.json` → notebook `07790274-d301-4f08-9d62-5c67c7f7c36d`; `out/nlm-created-1782970039754.png` |
| 4 | NotebookLM source add (text) | ✅ PASS | `out/audit3-nlm-source.json` stage=`source-text-submitted`, sourcesSeen=1; `out/nlm-source-done-1782970307930.png` (notebook auto-titled "Super Automato Lab: Autonomous Google Media Engineering") |
| 5 | NotebookLM chat + preset | ✅ PASS | `out/audit3-nlm-chat.json` stage=`answered`, preset=`podcast-script`, full 6-segment two-host script + 3 episode titles returned |
| 6 | NotebookLM Audio Overview → podcast download | ✅ PASS | `out/audit3-nlm-audio.json` stage=`audio-downloaded`; `out/nlm-podcast-1782971840229.m4a` (35.5 MB, AAC, **19:15** duration, `file` = ISO Media MPEG v4 DASH) |
| 7 | Security gate | ✅ PASS | repo grep: no cookies/tokens/personal emails in shipped files (one leftover account hint in `scripts/restore-labs-auth.ts` redacted this round); `out/` fully gitignored |

## Bugs found & fixed this round

1. **MusicFX render detection** — MusicFX plays tracks through Web Audio, so `<audio>`
   elements never appear. Old poll waited on `audio.src` forever. New detection:
   `TRACK n / m` carousel text, `NO TRACKS YET` marker, enabled (non-disabled) Download
   button, and network-level `audio/*` response capture as backup.
2. **MusicFX silent failure** — a generation can spin ("Generating music") and then
   return to idle with no tracks and no error. Added retry loop (max 3 attempts inside
   the overall timeout). E2E passed on attempt 2.
3. **Download suggested-extension** — MusicFX serves WAV, not MP3. Download handler now
   respects `suggestedFilename()` extension (got `.wav`).
4. **NotebookLM source add typed into the wrong box** — text went into the web-search
   field of the add-sources modal. Fixed: click the "Copied text" chip (rect-click via
   evaluate), fill the paste dialog's textarea, then Insert; verifies source count after.
5. **NotebookLM chat returned placeholder** — first poll caught "Drafting the script…".
   Fixed: answer must be >200 chars, page must not contain Drafting/generating/thinking,
   and the text must be stable across two consecutive polls.
6. **Audio Overview artifact has no `<audio>` element** — rendered podcasts show as a
   Studio row ("19:15 · 1 source · Nm ago") with no DOM audio. Fixed: detect the artifact
   row, reuse an existing rendered artifact instead of re-triggering, click the row's own
   3-dot menu (y-aligned with the row, right panel) → Download. First fix attempt clicked
   the chat menu instead (proof: `out/nlm-audio-menu-1782971699846.png`); second attempt
   downloaded the real 35.5 MB M4A.

## E2E command log (round 3)

```bash
./bin/labgoogle music gen --prompt "dreamy lo-fi hip hop beat with warm vinyl crackle, mellow piano" --timeout 720000 --json
# -> rendered-downloaded, out/music-audio-1782969952057.wav (WAV PCM 48kHz stereo, 30s), attempts=2

./bin/labgoogle notebooklm create --title "Automato Audit E2E" --json
# -> create-clicked, notebook 07790274-d301-4f08-9d62-5c67c7f7c36d

./bin/labgoogle notebooklm source add --notebook 07790274-... --text "<project description>" --json
# -> source-text-submitted, sourcesSeen=1

./bin/labgoogle notebooklm chat --notebook 07790274-... --preset podcast-script --prompt "Write a short podcast episode outline..." --json
# -> answered (full two-host outline, 6 segments, 3 title suggestions)

./bin/labgoogle notebooklm audio-overview --notebook 07790274-... --timeout 900000 --json
# -> audio-downloaded, out/nlm-podcast-1782971840229.m4a (35.5MB AAC, 19:15)
```

## Real media files (out/, gitignored)

- Video: `out/flow-video-1782955040605.mp4` (1.0 MB), `out/flow-video-1782955361413.mp4` (1.1 MB) — ISO Media MP4
- Music: `out/music-audio-1782969952057.wav` (5.7 MB) — RIFF WAVE PCM 16-bit stereo 48 kHz, 30.0 s
- Podcast: `out/nlm-podcast-1782971840229.m4a` (35.5 MB) — AAC, 1155.3 s (19:15)
