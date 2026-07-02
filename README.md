# Super Automato LabGoogle

Agent-native CLI harness that automates **Google Labs FX** (Flow / Veo video gen, MusicFX) and **NotebookLM** (chat, sources, Audio Overview podcasts) through a persistent Playwright browser profile.

Purpose: a real *automato* for autonomous content seeding — generate Veo clips, music loops, and Audio Overview podcasts straight from the terminal / an AI agent, with JSON output and screenshot proofs for every step.

## Architecture

```
bin/labgoogle              # thin wrapper -> npx tsx scripts/labgoogle.ts
scripts/labgoogle.ts       # main CLI (whoami / flow / music / notebooklm)
scripts/keepalive.ts       # session keep-alive (cron every ~3h)
scripts/*.ts               # selector probes & debug helpers
presets/*.txt              # chat prompt presets (podcast-script, seeding-content)
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
./bin/labgoogle music gen --prompt "short upbeat synth loop" --json
./bin/labgoogle notebooklm list --json
./bin/labgoogle notebooklm create --title "My Notebook" --json
./bin/labgoogle notebooklm source add --notebook "My Notebook" --url https://example.com --json
./bin/labgoogle notebooklm source add --notebook "My Notebook" --text "pasted source text" --json
./bin/labgoogle notebooklm source add --notebook "My Notebook" --file ./doc.pdf --json
./bin/labgoogle notebooklm chat --notebook "My Notebook" --prompt "Summarize" --preset podcast-script --json
./bin/labgoogle notebooklm audio-overview --notebook "My Notebook" --prompt "focus on key insights" --json
```

Every command returns JSON (`--json`) and writes screenshot proofs into `out/`.

### Chat presets

`--preset NAME` reads `presets/NAME.txt` and prepends it to your prompt for consistent behavior. `--system-file PATH` does the same with any file. Shipped presets:

- `podcast-script` — two-host podcast script style
- `seeding-content` — social seeding post variants + hashtags

## Status (2026-07-02 audit)

| Command | Status | Notes |
|---|---|---|
| `whoami` | ✅ WORKING | Labs session API reports signed-in (masked account). |
| `flow gen` (render poll + download) | 🟡 CODE READY / E2E BLOCKED | Render-poll bug fixed (video src detection), download chain: UI button → http fetch → blob fetch, `file`-verified. E2E blocked by Google account chooser (UI session signed out). |
| `music gen` | 🟡 CODE READY / E2E BLOCKED | Full submit → poll → download wired, MusicFX first with Flow fallback. Same UI auth blocker. |
| `notebooklm list/create/source add/chat/audio-overview` | 🟡 CODE READY / E2E BLOCKED | Full suite wired incl. Audio Overview trigger + poll + audio download. NotebookLM currently redirects to `accounts.google.com` sign-in rejected page. |

## Known issues

- **UI auth divergence:** the Labs `fx/api/auth/session` cookie can stay valid while the interactive Google UI session expires (`accounts.google.com` account chooser / `signin/rejected`). When that happens all UI commands report `blocked-auth-wall` with screenshot proof. Fix: refresh cookies into the profile from a real signed-in browser, then rerun.
- MusicFX is legacy (sunsets 2026-07-31); the CLI falls back to prompting Flow for music.
- NotebookLM selectors are best-effort; Google ships UI changes often. Each command screenshots its state so failures are diagnosable.

## Security

- Never prints cookies/tokens; account emails are masked in output.
- Profile dir, storage-state, cookies, screenshots, and media outputs are gitignored.
- The CLI never logs out, never deletes cookies, never brute-forces login or captchas — on auth walls it screenshots and reports `blocked-auth-wall`.

## License

MIT
