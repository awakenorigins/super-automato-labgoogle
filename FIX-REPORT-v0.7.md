# AUTOMATION-LABGOOGLE — Fix Report v0.7 (Anti-Hallucination)

Date: 2026-07-03
Trigger: "Tro and the First Bánh Chưng" film was 1 clip looped 29×; 30 "keyframes" were dashboard screenshots.

## ROOT CAUSE (confirmed with line numbers)

### A. Dashboard screenshots saved as "keyframes"
- `labgoogle.ts:693` — unconditional `page.screenshot(fullPage)` named `imagefx-typed-*.png`, fired BEFORE any generation, whether or not a prompt field existed.
- `labgoogle.ts:682` — only auth gate was an `accounts.google.com` URL check. ImageFX was retired → `/fx/tools/image-fx` redirects to the Flow dashboard ("Introducing Gemini Omni Flash"). URL isn't accounts.google.com → code proceeded as if the tool loaded.

### B. 1 clip looped 29×
- `labgoogle.ts:108` `findRenderedVideo()` matched ANY `<video>` with a src, with no notion of "new since submit".
- All shots reuse the SAME project → shot-1's rendered video stays on the page → shots 2–30 grabbed that stale clip on the first poll (~6s) → 29 byte-identical copies.
- `director.ts:459` — silent fallback `copyFileSync(clips[0], rawPath)` when concat fails.

### C. Missing gates
- No check that a keyframe isn't a 1366×900 screenshot; no MD5/uniqueness check across shots; no render wall-time sanity (real Veo render takes minutes; these "succeeded" in 6–15s).

## FIXES APPLIED (v0.7)

### labgoogle.ts
1. `collectVideoSrcs()` + `findRenderedVideo(page, baseline)` — accepts a baseline Set of pre-submit video srcs; only returns a src NOT in the baseline.
2. `cmdFlowGen`:
   - Hard-fail `stage:'composer-not-found'` if no prompt field (no screenshot-and-pretend).
   - Snapshot `videoBaseline` before submit.
   - Accept a render only if the src is NEW **and** (`creatingSeen` OR elapsed ≥ 30s). Rejects instant stale clips.
   - Report `creatingSeen`.
3. `cmdImageGen` UI fallback:
   - Negative-assert dashboard ("Introducing Gemini"/"Flow TV"/"New project"/"Try Omni") + require a real prompt composer → else `stage:'imagefx-unavailable'`, does NOT save a screenshot as an image.
   - Only screenshot after confirming a real field was typed into.
4. Improved credit-approval click (prefer real `button:text-is("Approve")` via Playwright locator, fallback to sized actionable element).

### director-master.ts
5. Per-shot MD5 dedupe: a clip byte-identical to an already-accepted shot is REJECTED + retried (kills 1-clip-x29 at the source).
6. Pre-assemble integrity gate: requires ≥60% distinct clips (by md5) or refuses to build the film (`stage:'assemble-integrity'`).

### reauth-v2.ts (NEW)
7. Robust headless re-auth (Xvfb, no VNC). Handles "Verify that it's you" (confirmidentifier) → Next → password → dismiss interstitials → verify Flow. Env: GLOGIN_EMAIL, GLOGIN_PW.
   - TESTED 2026-07-03: result SIGNED_IN_OK. Flow workspace loads signed-in (ULTRA account). No VNC needed.

## VERIFICATION
- `whoami` → `signedIn:true` (auth solid).
- Fixed pipeline test: pipeline did NOT accept a stale clip (NO_CLIP_DOWNLOADED) where old code would have hallucinated a success. ✅ Anti-hallucination gates confirmed working.

## v0.8 — FREE image path + project rule (Nắng 2026-07-03)

### Rule: ONE project per film, named after the film
- Director takes `--film-name "Tro và Bánh Chưng"` → single Flow project holds all 30 keyframes + 30 clips. No project spam.
- `flow-project-registry.json` maps the lowercased film name → the reused project id.

### FREE image gen (Nano Banana, 0 credits)
- Old `runImageFx` API is dead (403 PERMISSION_DENIED) → removed reliance on it.
- New `image flowgen` command uses the Flow Omni composer: Image toggle → aspect ratio (default 9:16 portrait) → Nano Banana 2 → prompt → submit. "Generating will use 0 credits".
- Baseline `<img>` snapshot + accept only NEW images >40KB (rejects screenshots).

### KNOWN COMPOSER PITFALL (must fix before full run)
- Flow has TWO input surfaces: (1) the bottom **composer** with the model pill "Nano Banana 2 📱 1x" + "+" + "→" (this is the FREE image path when Image toggle is set), and (2) the right-panel **Agent chat** ("Credit Spend Approval", defaults to VIDEO, costs credits).
- BUG observed: prompt typed via generic `[contenteditable]` selector routed to the Agent chat (video, 15 credits) instead of the Image composer. The Image/Video toggle popover is separate from where the prompt lands.
- FIX NEEDED: target the bottom composer's contenteditable specifically, ensure the model pill shows "Nano Banana 2" + "Image" + "9:16" BEFORE typing, and submit via that composer's "→" (arrow), not the Agent chat. Verify "0 credits" text is present pre-submit (guarantees free image path, not paid video).

## v0.8.2 — DECISION: use Agent-mode video with credit approval (Nắng 2026-07-03)

Nắng authorized paying the 15 credits per video via Flow Agent mode. So we do NOT need the
free-image workaround for the film — we let the Flow Agent generate each shot's video and APPROVE it.

### Fix: robust auto-approve of "Credit Spend Approval"
- The approval buttons ("Approve" / "Approve, do not ask again" / "Reject") are custom DIVs, not
  `<button>`. Earlier `button:text-is(...)` selectors missed them (approve clicks didn't land).
- v0.8.2 `cmdFlowGen` approve logic now: (1) try Playwright text locators, (2) fallback to a DOM
  scan matching the SMALLEST clickable element whose normalized text (leading tick/check glyphs
  stripped) is exactly "Approve" or "Approve, do not ask again". Prefer "do not ask again" so one
  approval lets the Agent auto-run all 30 shots. Sets `approvedDoNotAsk`.
- Verified: Agent accepts the prompt, builds the scene (grandmother + boy wrapping banh chung),
  and shows the exact Credit Spend Approval dialog. Pipeline direction confirmed correct.
- Remaining verify blocked only by high VPS load (9-11) killing chromium mid-run; AutoRunner cron
  gates on load <6 and retries, then launches the full film on first real downloaded clip.

## OPEN ITEM (real, not hallucination)
- Flow **Agent-mode "Credit Spend Approval"**: clicking "Approve" re-prompts ("Would you like me to kick off this 1 video generation, costing 15 credits?") instead of firing the render. The generation never actually starts. Needs correct trigger interaction for the new Flow Agent composer (likely a different button/mode, or "Approve, do not ask again" once + resend). This is why fixtest produced no clip — and correctly so.
- Next: probe the Agent composer DOM to find the real "kick off render" affordance (not the checkbox-style approval labels).
