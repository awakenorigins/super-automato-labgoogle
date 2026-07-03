# Super Automato LabGoogle

Agent-native CLI harness that automates **Google Labs FX** (Flow / Veo video gen, MusicFX) and **NotebookLM** (chat, sources, Audio Overview podcasts) through a persistent Playwright browser profile.

Purpose: a real *automato* for autonomous content seeding — generate Veo clips, music loops, and Audio Overview podcasts straight from the terminal / an AI agent, with JSON output and screenshot proofs for every step.

## Architecture

```
bin/labgoogle              # thin wrapper -> npx tsx scripts/labgoogle.ts
scripts/labgoogle.ts       # main CLI (whoami / flow / music / image / notebooklm / assemble)
scripts/director.ts        # director orchestrator (brief → script → images → videos → music → assemble)
scripts/keepalive.ts       # session keep-alive (cron every ~3h)
scripts/*.ts               # selector probes & debug helpers
scripts/validate-director-preset.py  # offline contract validator for the director-film preset
presets/*.txt              # chat prompt presets (podcast-script, seeding-content, director-film, podcast-video)
out/                       # JSON results, screenshot proofs, downloaded media (gitignored)
```

- Persistent Chromium profile (Playwright `launchPersistentContext`), headless, `en-US` locale, `America/Los_Angeles` timezone (avoids MusicFX country-block).
- Every command opens its own context and closes it after the run (no parallel runs on the same profile).
- Auth = your own Google session cookies injected into the profile. **Nothing here bypasses login** — you must be signed in.

## Install

```bash
npm install         # playwright + tsx
npx playwright install chromium
```

Set your profile path and (optionally) an account hint used only for clicking the right entry on Google's account chooser:

```bash
export LABGOOGLE_ACCOUNT="YOUR_ACCOUNT"   # display name or email prefix, never printed
```

## Usage

```bash
./bin/labgoogle whoami --json
./bin/labgoogle flow gen --prompt "A tiny robot waves, 2s" --submit --timeout 600000 --json

# v0.4.1 — Flow project management (no more one-project-per-gen spam)
./bin/labgoogle flow gen --prompt "scene 2" --project "My Film" --submit --json   # reuses project "My Film"; creates+renames only if missing (default: Automato-Sandbox)
./bin/labgoogle flow projects --json                                              # list existing projects {name,url,id}
./bin/labgoogle flow project delete --name "Untitled project" --json              # explicit cleanup only, with confirm-dialog handling
./bin/labgoogle music gen --prompt "short upbeat synth loop" --json
./bin/labgoogle notebooklm list --json
./bin/labgoogle notebooklm create --title "My Notebook" --json
./bin/labgoogle notebooklm source add --notebook "My Notebook" --url https://example.com --json
./bin/labgoogle notebooklm source add --notebook "My Notebook" --text "pasted source text" --json
./bin/labgoogle notebooklm source add --notebook "My Notebook" --file ./doc.pdf --json
./bin/labgoogle notebooklm chat --notebook "My Notebook" --prompt "Summarize" --preset podcast-script --json
./bin/labgoogle notebooklm audio-overview --notebook "My Notebook" --prompt "focus on key insights" --json

# v0.4.0 — image gen (ImageFX API first, UI fallback)
./bin/labgoogle image gen --prompt "watercolor robot with red balloon" --count 2 --ratio landscape --json

# v0.4.0 — assemble (pure ffmpeg, no Google auth needed)
./bin/labgoogle assemble concat --clips a.mp4,b.mp4 --out final.mp4 --size 1280x720 --fps 24 --json
./bin/labgoogle assemble mix --audio voice.m4a --music bg.wav --out mixed.m4a --music-volume 0.15 --loop --json

# v0.5.0 — Director Orchestrator (brief → full film pipeline)
./bin/labgoogle director run \
  --brief "30-second film about a boy and his first banh chung, Pixar 3D style" \
  --project "My-Film" --json
./bin/labgoogle assemble mux --video v.mp4 --audio a.m4a --out final.mp4 --fit loop-video --json

# v0.6.0 — Master Director (storyboard-first, SFX-only, Vietnamese vocal, 5 min)
# Provide storyboard.fallback.json in the output dir to skip NLM (recommended)
./bin/labgoogle director run \
  --brief "Phim điện ảnh 5 phút - câu bé tro và chiếc bàn" \
  --project "Automato-Film-Tro" \
  --minutes 5 \
  --no-music \
  --vocal vi \
  --out out/ --json

# Or run via the retry-wrapper script (recommended for long renders):
bash scripts/run-tro-5min.sh
```

Every command returns JSON (`--json`) and writes screenshot proofs into `out/`.

### Chat presets

`--preset NAME` reads `presets/NAME.txt` and prepends it to your prompt for consistent behavior. `--system-file PATH` does the same with any file. Shipped presets:

- `podcast-script` — two-host podcast script style
- `seeding-content` — social seeding post variants + hashtags
- `director-film` — brief → director shooting script: 5–8s scenes, VERBATIM repeated character sheets (AI video models have no cross-scene memory — the literal repeated text IS the memory), per-scene image_prompt + video_prompt (with camera movement), mood/lighting, sound; strict JSON + `---HUMAN---` readable part. Offline contract validator: `python3 scripts/validate-director-preset.py [response.txt]`.
- `podcast-video` — podcast topic → Vietnamese two-host script, per-segment 16:9 image prompts, loopable music prompt, and an ordered `assemble` pipeline.

### Assemble (ffmpeg)

No Google auth needed — pure local ffmpeg (6.x):

- `assemble concat` re-encodes and normalizes every clip (scale+pad to `--size`, `--fps`, yuv420p, 48 kHz stereo audio — silent track injected for mute clips like raw Veo renders) then concatenates.
- `assemble mix` ducks background music under a voice track (`--music-volume`, default 0.15), optionally `--loop`s the music to the full voice duration, adds a 3 s fade-out, output length locked to the voice.
- `assemble mux` marries a video with an audio track: `--fit shortest` (stream-copy video) or `--fit loop-video` (loop video to cover the full audio).

### Flow projects (`--project`)

`flow gen` no longer creates a fresh project on every run. It opens the Flow homepage, looks for a project card whose title matches `--project` (exact match first, then substring), and clicks into it. Only when no match exists does it create a new project — and immediately renames it to your `--project` value (default `Automato-Sandbox`). Repeated gens with the same `--project` land in the **same** project, so a multi-scene film accumulates in one place. JSON output reports `projectUrl` / `projectReused` / `projectCreated` / `projectRenamed`. `flow projects --json` lists what exists; `flow project delete --name` is the only deletion path and is never called automatically.

### Image gen engine choice

`image gen` tries the **ImageFX backend API** (`aisandbox-pa.googleapis.com/v1:runImageFx`) first using the labs session `access_token` — headless, fast, returns base64 PNGs, and it is the same Imagen backend that Flow's image ingredients use. If the token is dead it falls back to the **ImageFX UI** (`labs.google/fx/tools/image-fx`) with network-level image capture. Flow's own UI image mode was probed but is gated behind the same interactive session, so ImageFX is the primary engine.

## Status v0.5.0 (2026-07-03, Director Orchestrator)

| Command | Status | Notes |
|---|---|---|
| `director run --brief` | ✅ E2E PASS | Brief → 4-scene script → 4 Veo videos → MusicFX score → concat+mux = **film-final.mp4** (40s, 1280×720, H.264+AAC, 11MB) |
| Script generation | ✅ PASS (fallback) | NLM auth-walled; built-in LLM fallback generated 4-scene JSON with verbatim character sheets |
| Veo video gen (4 scenes) | ✅ 4/4 PASS | Each ~10s, all rendered+downloaded successfully via Flow |
| MusicFX background score | ✅ PASS | PCM WAV 16-bit stereo 48kHz |
| ffmpeg assemble | ✅ PASS | concat 4 clips → film-raw.mp4, mux with music at 18% volume → film-final.mp4 |
| ImageFX keyframes | ❌ 0/4 | API token expired during run; videos rendered prompt-only (no keyframe reference) |
| Checkpoint/resume | ✅ PASS | `state.json` saved after every step |

## Status v0.4.1 (2026-07-02, round 5)

| Command | Status | Notes |
|---|---|---|
| `flow gen --project` / `flow projects` / `flow project delete` | ✅ shipped, ⛔ E2E blocked-auth | Project reuse by name, create+rename fallback, explicit delete. Live E2E pending re-auth. |
| `image gen`, NotebookLM live director test | ⛔ BLOCKED-auth | Auth re-test round 5: headful recovery attempt ends at a real Google **password challenge** (screenshot proof in AUDIT-REPORT). No password entry per policy. Unblock = manual sign-in once + export profile. |

## Status v0.4.0 (2026-07-02, round 4)

| Command | Status | Notes |
|---|---|---|
| `assemble concat` | ✅ E2E PASS | 2 real Veo MP4s → normalized 1280x720@24fps, 8.02 s output, silent audio injected. |
| `assemble mix` | ✅ E2E PASS | 19:15 NotebookLM podcast + looped 30 s MusicFX WAV @0.15 → output duration matches voice to the ms. |
| `assemble mux` | ✅ E2E PASS | 8 s video looped over 30 s audio (`--fit loop-video`). |
| `presets/director-film` + validator | ✅ PASS (offline) | 50/50 contract checks. Live NotebookLM test BLOCKED-auth. |
| `presets/podcast-video` | ✅ shipped | Live test BLOCKED-auth. |
| `image gen` | ⛔ BLOCKED-auth | Code shipped (API+UI fallback). Every Google session on the VPS was revoked server-side (tokeninfo: Invalid Value; signin/rejected). See AUDIT-REPORT v0.4.0. |

## Status (2026-07-02 audit, round 3 — full E2E PASS)

| Command | Status | Notes |
|---|---|---|
| `whoami` | ✅ E2E PASS | Labs session API reports signed-in (masked account). |
| `flow gen` (render poll + download) | ✅ E2E PASS | Real Veo MP4 rendered + downloaded (`file`-verified ISO Media MP4). Auto-approves the Flow agent credit dialog. |
| `music gen` | ✅ E2E PASS | Real WAV downloaded (PCM 16-bit stereo 48 kHz, 30 s). Detects tracks via "TRACK n/m" carousel + enabled Download button (MusicFX uses Web Audio, no `<audio>` element); retries silent-fail generations up to 3×; network-level audio capture as last-resort fallback. |
| `notebooklm list` | ✅ E2E PASS | Lists notebooks (title scrape). |
| `notebooklm create` | ✅ E2E PASS | Creates notebook, returns its URL/ID. |
| `notebooklm source add --text` | ✅ E2E PASS | Clicks the "Copied text" chip in the add-sources modal, fills paste dialog, Inserts, verifies source count. |
| `notebooklm chat --preset` | ✅ E2E PASS | Sends preset+prompt, polls until the answer is substantive and stable (not "Drafting…"). |
| `notebooklm audio-overview` | ✅ E2E PASS | Triggers Studio Audio Overview, polls for the artifact row (duration + "n source"), opens its 3-dot menu → Download. Real 19-min podcast M4A downloaded and `file`-verified. |

## Known issues

- **UI auth divergence:** the Labs `fx/api/auth/session` cookie can stay valid while the interactive Google UI session expires (`accounts.google.com` account chooser / `signin/rejected`). When that happens all UI commands report `blocked-auth-wall` with screenshot proof. Fix: refresh cookies into the profile from a real signed-in browser, then rerun.
- MusicFX is legacy (sunsets 2026-07-31); the CLI falls back to prompting Flow for music. MusicFX generation can silently return to idle without an error — the CLI retries up to 3 attempts.
- NotebookLM Audio Overview renders server-side (5–15 min typical); an already-rendered artifact is detected and reused instead of triggering a duplicate.
- NotebookLM selectors are best-effort; Google ships UI changes often. Each command screenshots its state so failures are diagnosable.


### Project reuse (no spam) — v0.4.2

`flow gen --project "NAME"` reuses one Flow project per creative project instead of creating a new one each run. A local `flow-project-registry.json` maps NAME→projectId so reuse is deterministic even though Flow's UI hides project titles. First run creates+registers; later runs open the same project. `flow projects --json` lists projects; `flow project delete --name "NAME"` removes one on request.

Default profile: `google-flow-login-profile` (owner-authenticated). Session kept alive by `labgoogle-forever-keeper.sh` + the `LabGoogle keepalive` cron.

## Security

- Never prints cookies/tokens; account emails are masked in output.
- Profile dir, storage-state, cookies, screenshots, and media outputs are gitignored.
- The CLI never logs out, never deletes cookies, never brute-forces login or captchas — on auth walls it screenshots and reports `blocked-auth-wall`.

## License

MIT
