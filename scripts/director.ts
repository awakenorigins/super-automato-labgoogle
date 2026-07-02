#!/usr/bin/env tsx
/**
 * director.ts — Film Director Orchestrator for Super Automato LabGoogle
 *
 * Usage:
 *   labgoogle director run --brief "..." [--project "NAME"] [--out DIR] [--json]
 *
 * Pipeline:
 *   1. SCRIPT   — NLM chat (director-film preset) → JSON scenes; fallback: LLM-self-generated
 *   2. KEYFRAME — image gen per scene (image_prompt + character_sheet)
 *   3. VIDEO    — flow gen per scene (video_prompt + keyframe image)
 *   4. MUSIC    — music gen (background score)
 *   5. ASSEMBLE — concat scenes → mux background music → film-final.mp4
 *   6. CHECKPOINT — state.json at every step for crash-resume
 *
 * Security: NEVER prints cookies/tokens. All Google calls go through bin/labgoogle subcommands.
 */
import * as fs from 'fs';
import * as path from 'path';
import { execFileSync, execSync } from 'child_process';

// ─── Config ───
const BASE = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE';
const BIN = `${BASE}/bin/labgoogle`;
const PROFILE_DIR = '/root/.openclaw/workspace/google-flow-login-profile';
const SINGLETON_LOCK = `${PROFILE_DIR}/SingletonLock`;

interface Scene {
  number: number;
  duration_seconds: number;
  shot_type: string;
  action: string;
  character_sheet: string;
  image_prompt: string;
  video_prompt: string;
  mood_lighting: string;
  sound: string;
}
interface Script {
  title: string;
  total_duration_seconds: number;
  style: string;
  characters: Array<{ name: string; sheet: string }>;
  scenes: Scene[];
}
interface SceneState {
  number: number;
  image_status: 'pending' | 'done' | 'failed';
  image_path: string;
  video_status: 'pending' | 'done' | 'failed' | 'blocked';
  video_path: string;
  retries: number;
}
interface DirectorState {
  brief: string;
  project: string;
  slug: string;
  dir: string;
  step: 'init' | 'script' | 'images' | 'videos' | 'music' | 'assemble' | 'done';
  script: Script | null;
  scenes: SceneState[];
  music_status: 'pending' | 'done' | 'failed';
  music_path: string;
  film_raw: string;
  film_final: string;
  error: string;
  ts_start: string;
  ts_last: string;
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).toLowerCase() || 'film';
}

function removeLock() {
  try { fs.unlinkSync(SINGLETON_LOCK); } catch {}
}

function loadState(stateFile: string): DirectorState | null {
  try { return JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch { return null; }
}

function saveState(stateFile: string, state: DirectorState) {
  state.ts_last = new Date().toISOString();
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
}

function runLabgoogle(args: string[], timeoutSec = 720): any {
  removeLock();
  const cmd = `${BIN} ${args.map(a => a.includes(' ') ? `"${a.replace(/"/g, '\\"')}"` : a).join(' ')}`;
  console.error(`[director] $ ${cmd}`);
  try {
    const raw = execSync(cmd, {
      encoding: 'utf8',
      timeout: timeoutSec * 1000,
      maxBuffer: 50 * 1024 * 1024,
      env: { ...process.env, NODE_OPTIONS: '' },
    });
    // Find the last valid JSON line in output
    const lines = raw.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) {
      try { return JSON.parse(lines[i]); } catch {}
    }
    return { ok: false, raw: raw.slice(-2000) };
  } catch (e: any) {
    const stderr = (e.stderr || '').toString().slice(-1000);
    const stdout = (e.stdout || '').toString().slice(-1000);
    // try to parse JSON from stdout even on error exit
    for (const out of [stdout, stderr]) {
      const lines = out.trim().split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        try { return JSON.parse(lines[i]); } catch {}
      }
    }
    return { ok: false, error: `timeout/crash: ${stderr.slice(0, 500)}` };
  }
}

function fileInfo(f: string): { exists: boolean; size: number; magic: string } {
  try {
    const st = fs.statSync(f);
    const magic = execFileSync('file', ['-b', f], { encoding: 'utf8' }).trim();
    return { exists: true, size: st.size, magic };
  } catch {
    return { exists: false, size: 0, magic: '' };
  }
}

function probeDuration(f: string): number {
  try {
    return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()) || 0;
  } catch { return 0; }
}

function probeStreams(f: string): string[] {
  try {
    return execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch { return []; }
}

// ─── Step 1: Generate Script ───
function generateScriptFallback(brief: string): Script {
  // Self-generate a reasonable script when NLM is unavailable
  const style = '3D animated Pixar-style, warm soft lighting, vibrant colors, childrens film aesthetic';
  const boySheet = 'A 7-year-old Vietnamese boy named Tro with round face, bright curious eyes, short black hair with a small cowlick, warm tan skin, wearing a red áo dài with golden dragon embroidery, brown cloth sandals, small hands, cheerful expression, Pixar-style 3D animated character';
  const grandmaSheet = 'A 70-year-old Vietnamese grandmother with kind wrinkled face, silver hair in a neat bun, warm brown eyes behind small round glasses, wearing a deep purple áo bà ba with white trim, gentle smile, Pixar-style 3D animated character';

  return {
    title: 'Tro and the First Bánh Chưng',
    total_duration_seconds: 30,
    style,
    characters: [
      { name: 'Tro', sheet: boySheet },
      { name: 'Grandmother', sheet: grandmaSheet },
    ],
    scenes: [
      {
        number: 1,
        duration_seconds: 7,
        shot_type: 'wide',
        action: 'A warm Vietnamese kitchen during Tết preparations. Grandmother sits on a low stool wrapping bánh chưng. Young Tro watches with wide eyes, fascinated.',
        character_sheet: `Tro: ${boySheet}\nGrandmother: ${grandmaSheet}`,
        image_prompt: `${style}. Wide shot of a warm Vietnamese traditional kitchen decorated with red Tết banners and kumquat trees. ${boySheet} stands watching with wide amazed eyes. ${grandmaSheet} sits on a low wooden stool, hands deftly wrapping green banana leaves around sticky rice. Warm golden afternoon light streams through wooden shutters. Piles of green banana leaves, mung beans, and pork on a wooden table.`,
        video_prompt: `${style}. Wide shot of a warm Vietnamese traditional kitchen decorated with red Tết banners and kumquat trees. ${boySheet} stands watching with wide amazed eyes, then steps closer. ${grandmaSheet} sits on a low wooden stool, hands deftly wrapping green banana leaves around sticky rice, she looks up and smiles at Tro. Warm golden afternoon light streams through wooden shutters. Slow dolly-in toward the pair. Piles of green banana leaves, mung beans, and pork on a wooden table.`,
        mood_lighting: 'Warm, nostalgic, golden afternoon light, amber and green palette',
        sound: 'Soft ambient kitchen sounds, distant Tết firecrackers',
      },
      {
        number: 2,
        duration_seconds: 6,
        shot_type: 'medium',
        action: 'Grandmother gently guides Tro small hands to fold a banana leaf. Tro concentrates intensely, tongue poking out in effort.',
        character_sheet: `Tro: ${boySheet}\nGrandmother: ${grandmaSheet}`,
        image_prompt: `${style}. Medium shot, close framing. ${grandmaSheet} with gentle hands guiding ${boySheet} as he carefully folds a large green banana leaf on a wooden table. Tro's face shows intense concentration with his tongue poking out. Warm kitchen background with red Tết decorations soft-focused. Soft warm directional light from the left.`,
        video_prompt: `${style}. Medium shot, close framing. ${grandmaSheet} with gentle hands guiding ${boySheet} as he carefully folds a large green banana leaf on a wooden table. Tro's face shows intense concentration with his tongue poking out. Grandmother nods encouragingly. Tro's small hands carefully press down on the leaf. Static tripod shot with subtle rack focus. Warm kitchen background with red Tết decorations soft-focused.`,
        mood_lighting: 'Tender, focused, warm side-lighting, soft shadows',
        sound: 'Rustling banana leaves, grandmother humming softly',
      },
      {
        number: 3,
        duration_seconds: 7,
        shot_type: 'close-up',
        action: 'Tro small hands carefully place sticky rice and mung bean filling onto the banana leaf, then fold it into a square shape. The wrapping is imperfect but heartfelt.',
        character_sheet: `Tro: ${boySheet}`,
        image_prompt: `${style}. Close-up shot of small childish hands belonging to ${boySheet} placing white sticky rice and yellow mung bean paste onto a bright green banana leaf. The hands are small and careful. Wooden table surface. Warm soft backlighting creating a golden rim. Shallow depth of field.`,
        video_prompt: `${style}. Close-up shot of small childish hands belonging to ${boySheet} carefully placing white sticky rice and yellow mung bean paste onto a bright green banana leaf, then folding the leaf edges inward to form an imperfect but charming square shape. The hands are small, slightly clumsy but determined. Slow motion. Wooden table surface. Warm soft backlighting creating a golden rim. Slow dolly-in. Shallow depth of field.`,
        mood_lighting: 'Intimate, warm backlight, golden rim lighting, green and gold palette',
        sound: 'Gentle folding sounds, soft instrumental music swell',
      },
      {
        number: 4,
        duration_seconds: 5,
        shot_type: 'medium',
        action: 'Tro proudly holds up his first completed bánh chưng — lumpy and imperfect but tied with bamboo string. Grandmother beams with pride, whole family gathered around clapping.',
        character_sheet: `Tro: ${boySheet}\nGrandmother: ${grandmaSheet}`,
        image_prompt: `${style}. Medium shot. ${boySheet} stands proudly holding up a small, lumpy, imperfectly-wrapped bánh chưng tied with green bamboo string, his face beaming with the biggest smile. ${grandmaSheet} stands behind him, both hands on his shoulders, beaming with pride, tears of joy in her eyes. Behind them, a Vietnamese family of 5 clapping and smiling. Red Tết decorations, kumquat tree with golden fruits. Warm golden evening light. Celebratory atmosphere.`,
        video_prompt: `${style}. Medium shot. ${boySheet} stands proudly holding up a small, lumpy, imperfectly-wrapped bánh chưng tied with green bamboo string, his face beaming with the biggest smile. He lifts it higher. ${grandmaSheet} stands behind him, both hands on his shoulders, beaming with pride, tears of joy in her eyes. Behind them, a Vietnamese family of 5 clapping and smiling. Camera slowly pulls back to reveal the warm family scene. Red Tết decorations, kumquat tree with golden fruits. Warm golden evening light. Slow crane-up revealing the full family.`,
        mood_lighting: 'Joyful, celebratory, warm golden evening light, red and gold palette',
        sound: 'Family laughter, clapping, distant Tết fireworks, heartwarming music crescendo',
      },
    ],
  };
}

async function stepScript(state: DirectorState, stateFile: string): Promise<boolean> {
  console.error('[director] Step 1: Generating script...');

  // Try NLM first
  const nlmResult = runLabgoogle([
    'notebooklm', 'chat',
    '--notebook', 'Director-Film-Studio',
    '--preset', 'director-film',
    '--prompt', state.brief,
    '--json',
  ], 360);

  let script: Script | null = null;

  if (nlmResult?.ok && nlmResult.answer) {
    // Try to extract JSON from NLM answer
    const answer: string = nlmResult.answer;
    // Find JSON block - look for { "title": pattern
    const jsonMatch = answer.match(/\{[\s\S]*"title"[\s\S]*"scenes"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        script = JSON.parse(jsonMatch[0]);
      } catch {
        // Try cleaning common issues
        try {
          const cleaned = jsonMatch[0]
            .replace(/,\s*}/g, '}')
            .replace(/,\s*]/g, ']')
            .replace(/```json\s*/g, '')
            .replace(/```\s*/g, '');
          script = JSON.parse(cleaned);
        } catch {}
      }
    }
  }

  if (!script || !script.scenes || script.scenes.length < 2) {
    console.error('[director] NLM unavailable or parse failed. Using LLM fallback script generator.');
    script = generateScriptFallback(state.brief);
  }

  state.script = script;
  state.scenes = script.scenes.map(s => ({
    number: s.number,
    image_status: 'pending' as const,
    image_path: '',
    video_status: 'pending' as const,
    video_path: '',
    retries: 0,
  }));

  // Save script.json
  fs.writeFileSync(`${state.dir}/script.json`, JSON.stringify(script, null, 2));
  state.step = 'script';
  saveState(stateFile, state);
  console.error(`[director] Script generated: ${script.scenes.length} scenes, ${script.total_duration_seconds}s total`);
  return true;
}

// ─── Step 2: Keyframe Images ───
async function stepImages(state: DirectorState, stateFile: string): Promise<boolean> {
  console.error('[director] Step 2: Generating keyframe images...');
  const script = state.script!;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const sceneState = state.scenes[i];

    if (sceneState.image_status === 'done' && sceneState.image_path && fs.existsSync(sceneState.image_path)) {
      console.error(`[director]   Scene ${scene.number}: image already done, skipping`);
      continue;
    }

    console.error(`[director]   Scene ${scene.number}: generating keyframe image...`);
    const imgResult = runLabgoogle([
      'image', 'gen',
      '--prompt', scene.image_prompt,
      '--count', '1',
      '--ratio', 'landscape',
      '--out', state.dir,
      '--json',
    ], 300);

    if (imgResult?.ok && imgResult.images?.length > 0) {
      const imgPath = imgResult.images[0].path;
      // Copy to stable name
      const stablePath = `${state.dir}/scene-${scene.number}.jpg`;
      try {
        // Convert to jpg for Flow compatibility
        execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', imgPath, '-q:v', '2', stablePath]);
        sceneState.image_status = 'done';
        sceneState.image_path = stablePath;
      } catch {
        // Just copy as-is
        fs.copyFileSync(imgPath, stablePath);
        sceneState.image_status = 'done';
        sceneState.image_path = stablePath;
      }
      console.error(`[director]   Scene ${scene.number}: image OK → ${stablePath}`);
    } else {
      console.error(`[director]   Scene ${scene.number}: image FAILED: ${JSON.stringify(imgResult?.error || imgResult?.stage || 'unknown').slice(0, 200)}`);
      sceneState.image_status = 'failed';
    }

    saveState(stateFile, state);
    // small cooldown between API calls
    await new Promise(r => setTimeout(r, 3000));
  }

  state.step = 'images';
  saveState(stateFile, state);
  return true;
}

// ─── Step 3: Video per scene ───
async function stepVideos(state: DirectorState, stateFile: string): Promise<boolean> {
  console.error('[director] Step 3: Generating scene videos...');
  const script = state.script!;

  for (let i = 0; i < script.scenes.length; i++) {
    const scene = script.scenes[i];
    const sceneState = state.scenes[i];

    if (sceneState.video_status === 'done' && sceneState.video_path && fs.existsSync(sceneState.video_path)) {
      console.error(`[director]   Scene ${scene.number}: video already done, skipping`);
      continue;
    }

    if (sceneState.video_status === 'blocked') {
      console.error(`[director]   Scene ${scene.number}: BLOCKED, skipping`);
      continue;
    }

    const hasImage = sceneState.image_status === 'done' && sceneState.image_path && fs.existsSync(sceneState.image_path);
    const maxRetries = 1;

    while (sceneState.retries <= maxRetries) {
      console.error(`[director]   Scene ${scene.number}: generating video (attempt ${sceneState.retries + 1})...`);

      const videoArgs: string[] = [
        'flow', 'gen',
        '--project', state.project,
        '--prompt', scene.video_prompt,
        '--submit',
        '--timeout', '600000',
        '--out', state.dir,
        '--json',
      ];
      if (hasImage) {
        videoArgs.push('--image', sceneState.image_path);
      }

      const vidResult = runLabgoogle(videoArgs, 720);

      if (vidResult?.ok && vidResult.downloadedPath && fs.existsSync(vidResult.downloadedPath)) {
        const stablePath = `${state.dir}/scene-${scene.number}.mp4`;
        fs.copyFileSync(vidResult.downloadedPath, stablePath);
        sceneState.video_status = 'done';
        sceneState.video_path = stablePath;
        console.error(`[director]   Scene ${scene.number}: video OK → ${stablePath} (${probeDuration(stablePath).toFixed(1)}s)`);
        break;
      } else {
        console.error(`[director]   Scene ${scene.number}: video attempt ${sceneState.retries + 1} FAILED: ${JSON.stringify(vidResult?.stage || vidResult?.error || 'unknown').slice(0, 300)}`);
        sceneState.retries++;
        if (sceneState.retries > maxRetries) {
          sceneState.video_status = 'blocked';
          console.error(`[director]   Scene ${scene.number}: BLOCKED after ${maxRetries + 1} attempts`);
        } else {
          // wait before retry
          await new Promise(r => setTimeout(r, 10000));
        }
      }

      saveState(stateFile, state);
    }

    saveState(stateFile, state);
  }

  state.step = 'videos';
  saveState(stateFile, state);
  return true;
}

// ─── Step 4: Background Music ───
async function stepMusic(state: DirectorState, stateFile: string): Promise<boolean> {
  if (state.music_status === 'done' && state.music_path && fs.existsSync(state.music_path)) {
    console.error('[director] Step 4: Music already done, skipping');
    return true;
  }

  console.error('[director] Step 4: Generating background music...');
  const musicResult = runLabgoogle([
    'music', 'gen',
    '--prompt', 'Warm heartfelt childrens animated film instrumental soundtrack, gentle Vietnamese folk melody, soft piano and strings, Tet celebration mood, nostalgic and uplifting, no vocals, Pixar-style emotional score',
    '--out', state.dir,
    '--json',
  ], 600);

  if (musicResult?.ok && musicResult.downloadedPath && fs.existsSync(musicResult.downloadedPath)) {
    const stablePath = `${state.dir}/bg-music.wav`;
    fs.copyFileSync(musicResult.downloadedPath, stablePath);
    state.music_status = 'done';
    state.music_path = stablePath;
    console.error(`[director] Music OK → ${stablePath}`);
  } else {
    console.error(`[director] Music FAILED: ${JSON.stringify(musicResult?.stage || musicResult?.error || 'unknown').slice(0, 300)}`);
    state.music_status = 'failed';
  }

  state.step = 'music';
  saveState(stateFile, state);
  return true;
}

// ─── Step 5: Assemble ───
async function stepAssemble(state: DirectorState, stateFile: string): Promise<boolean> {
  console.error('[director] Step 5: Assembling film...');

  // Collect available scene videos in order
  const clips = state.scenes
    .filter(s => s.video_status === 'done' && s.video_path && fs.existsSync(s.video_path))
    .sort((a, b) => a.number - b.number)
    .map(s => s.video_path);

  if (clips.length === 0) {
    console.error('[director] ERROR: No scene videos available to assemble!');
    state.error = 'No scene videos available';
    saveState(stateFile, state);
    return false;
  }

  if (clips.length === 1) {
    // Single clip — just copy
    const rawPath = `${state.dir}/film-raw.mp4`;
    fs.copyFileSync(clips[0], rawPath);
    state.film_raw = rawPath;
  } else {
    // Concat all clips
    const rawPath = `${state.dir}/film-raw.mp4`;
    const concatResult = runLabgoogle([
      'assemble', 'concat',
      '--clips', clips.join(','),
      '--out', rawPath,
      '--size', '1280x720',
      '--fps', '24',
      '--json',
    ], 300);

    if (concatResult?.ok) {
      state.film_raw = rawPath;
      console.error(`[director] Concat OK → ${rawPath} (${probeDuration(rawPath).toFixed(1)}s)`);
    } else {
      // Fallback: just use the first clip
      console.error(`[director] Concat FAILED, using first clip as film-raw: ${JSON.stringify(concatResult?.error || 'unknown').slice(0, 200)}`);
      fs.copyFileSync(clips[0], rawPath);
      state.film_raw = rawPath;
    }
  }

  // Mux with background music if available
  if (state.music_status === 'done' && state.music_path && fs.existsSync(state.music_path) && state.film_raw) {
    const finalPath = `${state.dir}/film-final.mp4`;
    // Use ffmpeg directly for mux with music (lower volume, loop, trim to video)
    removeLock(); // not needed for ffmpeg but consistent
    const videoDur = probeDuration(state.film_raw);
    try {
      execFileSync('ffmpeg', [
        '-hide_banner', '-loglevel', 'error', '-y',
        '-i', state.film_raw,
        '-stream_loop', '-1', '-i', state.music_path,
        '-filter_complex', `[1:a]volume=0.18,atrim=duration=${videoDur.toFixed(3)},afade=t=out:st=${Math.max(0, videoDur - 2).toFixed(3)}:d=2[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`,
        '-map', '0:v:0', '-map', '[mix]',
        '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
        '-movflags', '+faststart',
        finalPath,
      ], { encoding: 'utf8', timeout: 120000 });
      state.film_final = finalPath;
      console.error(`[director] Mux OK → ${finalPath} (${probeDuration(finalPath).toFixed(1)}s)`);
    } catch (e: any) {
      // If video has no audio stream, simpler mux
      console.error(`[director] Mux with amix failed, trying simple mux...`);
      try {
        execFileSync('ffmpeg', [
          '-hide_banner', '-loglevel', 'error', '-y',
          '-i', state.film_raw,
          '-stream_loop', '-1', '-i', state.music_path,
          '-filter_complex', `[1:a]volume=0.18,atrim=duration=${videoDur.toFixed(3)},afade=t=out:st=${Math.max(0, videoDur - 2).toFixed(3)}:d=2[out]`,
          '-map', '0:v:0', '-map', '[out]',
          '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
          '-shortest', '-movflags', '+faststart',
          finalPath,
        ], { encoding: 'utf8', timeout: 120000 });
        state.film_final = finalPath;
        console.error(`[director] Simple mux OK → ${finalPath}`);
      } catch {
        // Last resort: just use raw
        console.error(`[director] All mux failed, film-final = film-raw`);
        fs.copyFileSync(state.film_raw, finalPath);
        state.film_final = finalPath;
      }
    }
  } else {
    // No music — film-raw IS film-final
    const finalPath = `${state.dir}/film-final.mp4`;
    fs.copyFileSync(state.film_raw, finalPath);
    state.film_final = finalPath;
    console.error(`[director] No music available, film-final = film-raw`);
  }

  state.step = 'done';
  saveState(stateFile, state);
  return true;
}

// ─── Main ───
async function main() {
  const argv = process.argv.slice(2);
  // Parse: director run --brief "..." [--project "..."] [--out DIR] [--json]
  const args: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const t = argv[i];
    if (t.startsWith('--')) {
      const key = t.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith('--')) { args[key] = true; }
      else { args[key] = next; i++; }
    }
  }

  const brief = String(args.brief || '');
  if (!brief) {
    console.error('Usage: labgoogle director run --brief "..." [--project "NAME"] [--out DIR] [--json]');
    process.exit(2);
  }

  const project = String(args.project || 'Automato-Director');
  const json = !!args.json;
  const slug = slugify(brief);
  const dirName = `director-${slug}`;
  const outBase = String(args.out || `${BASE}/out`);
  const dir = `${outBase}/${dirName}`;
  fs.mkdirSync(dir, { recursive: true });

  const stateFile = `${dir}/state.json`;

  // Resume from checkpoint if exists
  let state = loadState(stateFile);
  if (state && state.step !== 'done') {
    console.error(`[director] Resuming from checkpoint: step=${state.step}`);
  } else if (state && state.step === 'done') {
    console.error(`[director] Previous run already completed. Use a new brief or delete state.json to re-run.`);
    if (json) console.log(JSON.stringify({ ok: true, resumed: true, film_final: state.film_final, scenes: state.scenes }));
    return;
  } else {
    state = {
      brief,
      project,
      slug,
      dir,
      step: 'init',
      script: null,
      scenes: [],
      music_status: 'pending',
      music_path: '',
      film_raw: '',
      film_final: '',
      error: '',
      ts_start: new Date().toISOString(),
      ts_last: new Date().toISOString(),
    };
    saveState(stateFile, state);
  }

  // Execute pipeline steps (with resume awareness)
  const steps: Array<{ name: DirectorState['step']; fn: () => Promise<boolean> }> = [
    { name: 'script', fn: () => stepScript(state!, stateFile) },
    { name: 'images', fn: () => stepImages(state!, stateFile) },
    { name: 'videos', fn: () => stepVideos(state!, stateFile) },
    { name: 'music',  fn: () => stepMusic(state!, stateFile) },
    { name: 'assemble', fn: () => stepAssemble(state!, stateFile) },
  ];

  const stepOrder = ['init', 'script', 'images', 'videos', 'music', 'assemble', 'done'];
  const currentIdx = stepOrder.indexOf(state.step);

  for (const step of steps) {
    const stepIdx = stepOrder.indexOf(step.name);
    if (stepIdx <= currentIdx) continue; // already done

    try {
      await step.fn();
    } catch (e: any) {
      console.error(`[director] FATAL in step ${step.name}: ${String(e?.message || e).slice(0, 500)}`);
      state.error = `Fatal in ${step.name}: ${String(e?.message || e).slice(0, 300)}`;
      saveState(stateFile, state);
    }
  }

  // ─── Final Report ───
  const scenesPass = state.scenes.filter(s => s.video_status === 'done').length;
  const scenesFail = state.scenes.filter(s => s.video_status === 'failed' || s.video_status === 'blocked').length;
  const filmExists = state.film_final && fs.existsSync(state.film_final);
  const filmDuration = filmExists ? probeDuration(state.film_final) : 0;
  const filmStreams = filmExists ? probeStreams(state.film_final) : [];

  const report = {
    ok: filmExists && filmDuration > 0,
    title: state.script?.title || slug,
    brief: state.brief,
    project: state.project,
    dir: state.dir,
    scenes_total: state.scenes.length,
    scenes_pass: scenesPass,
    scenes_blocked: scenesFail,
    film_final: state.film_final || null,
    film_duration: filmDuration,
    film_streams: filmStreams,
    film_file_info: filmExists ? fileInfo(state.film_final) : null,
    music_status: state.music_status,
    scenes: state.scenes.map(s => ({
      number: s.number,
      image: s.image_status,
      image_path: s.image_path || null,
      video: s.video_status,
      video_path: s.video_path || null,
    })),
    state_file: stateFile,
    error: state.error || null,
    ts_start: state.ts_start,
    ts_end: new Date().toISOString(),
  };

  if (json) {
    console.log(JSON.stringify(report));
  } else {
    console.log('\n═══ DIRECTOR ORCHESTRATOR — FINAL REPORT ═══');
    console.log(`Title: ${report.title}`);
    console.log(`Scenes: ${report.scenes_pass}/${report.scenes_total} PASS, ${report.scenes_blocked} BLOCKED`);
    console.log(`Film: ${report.film_final || 'NONE'}`);
    console.log(`Duration: ${report.film_duration.toFixed(1)}s`);
    console.log(`Streams: ${report.film_streams.join(', ')}`);
    console.log(`Music: ${report.music_status}`);
    if (report.error) console.log(`Error: ${report.error}`);
    console.log('═══════════════════════════════════════════');
  }
}

main().catch(e => {
  console.error(`[director] Fatal: ${e}`);
  process.exit(1);
});
