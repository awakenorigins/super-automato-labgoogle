#!/usr/bin/env tsx
/**
 * director-master.ts — MASTER DIRECTOR ORCHESTRATOR (storyboard-first) for Super Automato LabGoogle
 *
 * Usage:
 *   labgoogle director run --brief "..." [--project "NAME"] [--minutes 5] [--no-music] [--vocal vi] [--out DIR] [--json]
 *
 * Pipeline (knowledge-driven, see knowledge/cinematic-ai-filmmaking.md):
 *   1. STORYBOARD — NLM chat (master-director preset) → full STORYBOARD JSON (40-60 shots); fallback: self JSON
 *   2. KEYFRAME   — image gen per shot (image_prompt + character core), used as Veo reference
 *   3. VIDEO      — flow gen per shot (video_prompt + keyframe ref), single project, continuity chain
 *   4. VOCAL      — edge-tts Vietnamese per shot with dialogue (no background music)
 *   5. SFX        — Veo native audio (SFX/ambient in prompt); no music track added
 *   6. ASSEMBLE   — sequential concat (normalize + concat demuxer) → mux vocal → film-final.mp4
 *   7. CHECKPOINT — state.json after EVERY shot for crash-resume
 *
 * Security: NEVER prints cookies/tokens. All Google calls go through bin/labgoogle subcommands.
 */
import * as fs from 'fs';
import { execFileSync, execSync } from 'child_process';

const BASE = '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE';
const BIN = `${BASE}/bin/labgoogle`;
const PROFILE_DIR = '/root/.openclaw/workspace/google-flow-login-profile';
const SINGLETON_LOCK = `${PROFILE_DIR}/SingletonLock`;
const PRESET = `${BASE}/presets/master-director.txt`;
const TTS_SCRIPT = '/root/.openclaw/workspace/skills/edge-tts/scripts/tts-converter.js';

interface ShotAudio {
  ambient?: string; foley?: string; spot_sfx?: string;
  dialogue?: string | null; dialogue_voice?: string | null;
}
interface Shot {
  number: number; act?: number; scene_title?: string;
  duration_seconds: number; shot_size?: string; camera_angle?: string;
  camera_movement?: string; lens?: string; subject?: string; action?: string;
  context?: string; lighting?: string; mood_color?: string;
  audio?: ShotAudio; transition_to_next?: string;
  image_prompt: string; video_prompt: string;
  character_core_refs?: string[]; continuity_note?: string;
}
interface Character { name: string; core: string; voice?: string; voice_desc?: string; }
interface Storyboard {
  title: string; total_duration_seconds: number; style: string;
  characters: Character[]; shots: Shot[];
}
interface ShotState {
  number: number;
  image_status: 'pending' | 'done' | 'failed'; image_path: string;
  video_status: 'pending' | 'done' | 'failed' | 'blocked'; video_path: string;
  vocal_status: 'none' | 'pending' | 'done' | 'failed'; vocal_path: string;
  retries: number;
}
interface MasterState {
  brief: string; project: string; slug: string; dir: string;
  minutes: number; noMusic: boolean; vocalLang: string;
  step: 'init' | 'storyboard' | 'keyframes' | 'videos' | 'vocals' | 'assemble' | 'done';
  storyboard: Storyboard | null;
  shots: ShotState[];
  film_raw: string; film_final: string; error: string;
  ts_start: string; ts_last: string;
}

function slugify(s: string): string {
  return s.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40).toLowerCase() || 'film';
}
function removeLock() { try { fs.unlinkSync(SINGLETON_LOCK); } catch {} }
function loadState(f: string): MasterState | null { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function saveState(f: string, s: MasterState) { s.ts_last = new Date().toISOString(); fs.writeFileSync(f, JSON.stringify(s, null, 2)); }

function runLabgoogle(args: string[], timeoutSec = 900): any {
  removeLock();
  const cmd = `${BIN} ${args.map(a => a.includes(' ') || a.includes('"') ? `'${a.replace(/'/g, `'\\''`)}'` : a).join(' ')}`;
  console.error(`[master] $ ${cmd.slice(0, 300)}`);
  try {
    const raw = execSync(cmd, { encoding: 'utf8', timeout: timeoutSec * 1000, maxBuffer: 64 * 1024 * 1024, env: { ...process.env, NODE_OPTIONS: '' } });
    const lines = raw.trim().split('\n');
    for (let i = lines.length - 1; i >= 0; i--) { try { return JSON.parse(lines[i]); } catch {} }
    return { ok: false, raw: raw.slice(-1500) };
  } catch (e: any) {
    const so = (e.stdout || '').toString(); const se = (e.stderr || '').toString();
    for (const out of [so, se]) { const lines = out.trim().split('\n'); for (let i = lines.length - 1; i >= 0; i--) { try { return JSON.parse(lines[i]); } catch {} } }
    return { ok: false, error: `timeout/crash: ${se.slice(-400)}` };
  }
}
function fileInfo(f: string) {
  try { const st = fs.statSync(f); const magic = execFileSync('file', ['-b', f], { encoding: 'utf8' }).trim(); return { exists: true, size: st.size, magic }; }
  catch { return { exists: false, size: 0, magic: '' }; }
}
function probeDuration(f: string): number { try { return parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim()) || 0; } catch { return 0; } }
function probeStreams(f: string): string[] { try { return execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', f], { encoding: 'utf8' }).trim().split('\n').filter(Boolean); } catch { return []; } }
function clampDur(d: number): number { return d <= 5 ? 4 : d <= 7 ? 6 : 8; }

// ─── Step 1: Storyboard via NLM master-director preset, fallback to self-authored 5-min Tro board ───
function extractJson(text: string): any | null {
  if (!text) return null;
  // strip fences
  let t = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '');
  const start = t.indexOf('{'); const end = t.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  const slice = t.slice(start, end + 1);
  try { return JSON.parse(slice); } catch {}
  // try trimming to a balanced object
  let depth = 0, cut = -1;
  for (let i = start; i <= end; i++) { if (t[i] === '{') depth++; else if (t[i] === '}') { depth--; if (depth === 0) { cut = i; break; } } }
  if (cut > start) { try { return JSON.parse(t.slice(start, cut + 1)); } catch {} }
  return null;
}

function generateStoryboardViaNLM(brief: string, dir: string): Storyboard | null {
  const presetName = 'master-director';
  const nbTitle = 'Master Director Storyboard';
  // ensure notebook exists (best-effort) then chat with preset
  const created = runLabgoogle(['notebooklm', 'create', '--title', nbTitle, '--json'], 300);
  const nb = created?.notebook || created?.id || nbTitle;
  const res = runLabgoogle(['notebooklm', 'chat', '--notebook', String(nb), '--preset', presetName, '--prompt', `Generate the full storyboard for this brief. Output ONLY the JSON. Brief: ${brief}`, '--json'], 600);
  const answer = res?.answer || res?.text || res?.result || '';
  const sb = extractJson(typeof answer === 'string' ? answer : JSON.stringify(answer));
  if (sb && Array.isArray(sb.shots) && sb.shots.length >= 6) {
    fs.writeFileSync(`${dir}/storyboard-nlm-raw.txt`, typeof answer === 'string' ? answer : JSON.stringify(answer, null, 2));
    return sb as Storyboard;
  }
  return null;
}

function storyboardToMarkdown(sb: Storyboard): string {
  let md = `# ${sb.title}\n\nTotal: ${sb.total_duration_seconds}s · Style: ${sb.style}\n\n## Characters\n`;
  for (const c of sb.characters || []) md += `- **${c.name}** (${c.voice || 'no voice'}): ${c.core}\n`;
  md += `\n## Shots (${sb.shots.length})\n\n`;
  for (const s of sb.shots) {
    md += `### Shot ${s.number} — ${s.scene_title || ''} [Act ${s.act || '?'}, ${s.duration_seconds}s]\n`;
    md += `- Size/Angle/Move: ${s.shot_size || ''} / ${s.camera_angle || ''} / ${s.camera_movement || ''}\n`;
    md += `- Action: ${s.action || ''}\n`;
    if (s.audio) md += `- Audio: ambient=${s.audio.ambient || ''}; foley=${s.audio.foley || ''}; sfx=${s.audio.spot_sfx || ''}; dialogue=${s.audio.dialogue || 'none'}\n`;
    md += `- Continuity: ${s.continuity_note || ''}\n\n`;
  }
  return md;
}

// inject character cores verbatim into a prompt (pipeline responsibility per preset)
function withCores(prompt: string, sb: Storyboard, refs?: string[]): string {
  if (!refs || !refs.length) return prompt;
  const cores = (sb.characters || []).filter(c => refs.includes(c.name)).map(c => c.core);
  if (!cores.length) return prompt;
  // Only append if the core text isn't already substantially present
  const missing = cores.filter(core => !prompt.includes(core.slice(0, 40)));
  if (!missing.length) return prompt;
  return `${prompt}\n[Characters — verbatim]: ${missing.join(' | ')}`;
}

function main() {
  const argv = process.argv.slice(2);
  const args: Record<string, any> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const nx = argv[i + 1]; if (!nx || nx.startsWith('--')) { args[k] = true; } else { args[k] = nx; i++; } }
  }
  const brief = String(args.brief || '');
  if (!brief) { console.log(JSON.stringify({ ok: false, error: 'missing --brief' })); process.exit(2); }
  const project = String(args.project || 'Automato-Film');
  const minutes = Number(args.minutes || 1);
  const noMusic = !!args['no-music'];
  const vocalLang = String(args.vocal || '');
  const slug = slugify(brief);
  const outRoot = String(args.out || `${BASE}/out`);
  const dir = `${outRoot}/master-${slug}`;
  fs.mkdirSync(dir, { recursive: true });
  const stateFile = `${dir}/state.json`;

  let state = loadState(stateFile);
  if (!state) {
    state = { brief, project, slug, dir, minutes, noMusic, vocalLang, step: 'init', storyboard: null, shots: [], film_raw: '', film_final: '', error: '', ts_start: new Date().toISOString(), ts_last: new Date().toISOString() };
    saveState(stateFile, state);
  }

  // ── Step 1: Storyboard ──
  if (!state.storyboard) {
    console.error('[master] Step 1: storyboard...');
    let sb: Storyboard | null = null;
    // Prefer a pre-authored high-quality fallback storyboard if present (avoids NLM auth-wall + huge-LLM timeouts).
    const fb = `${dir}/storyboard.fallback.json`;
    if (fs.existsSync(fb)) { try { sb = JSON.parse(fs.readFileSync(fb, 'utf8')); console.error('[master] using pre-authored storyboard.fallback.json'); } catch {} }
    if (!sb || !Array.isArray(sb.shots) || sb.shots.length < 4) { sb = generateStoryboardViaNLM(brief, dir); }
    if (!sb || !Array.isArray(sb.shots) || !sb.shots.length) {
      state.error = 'storyboard-generation-failed (NLM auth-wall or parse fail). Provide storyboard.fallback.json in the film dir to resume.';
      saveState(stateFile, state);
      console.log(JSON.stringify({ ok: false, stage: 'storyboard', error: state.error, dir }));
      process.exit(1);
    }
    // normalize durations to Veo-legal
    sb.shots.forEach(s => { s.duration_seconds = clampDur(s.duration_seconds || 8); });
    state.storyboard = sb;
    state.shots = sb.shots.map(s => ({ number: s.number, image_status: 'pending', image_path: '', video_status: 'pending', video_path: '', vocal_status: (s.audio && s.audio.dialogue) ? 'pending' : 'none', vocal_path: '', retries: 0 }));
    state.step = 'keyframes';
    fs.writeFileSync(`${dir}/storyboard.json`, JSON.stringify(sb, null, 2));
    fs.writeFileSync(`${dir}/storyboard.md`, storyboardToMarkdown(sb));
    saveState(stateFile, state);
    console.error(`[master] storyboard: ${sb.shots.length} shots, ${sb.total_duration_seconds}s`);
  }
  const sb = state.storyboard!;

  // ── Step 2+3: per-shot keyframe → video (checkpoint each) ──
  for (const shot of sb.shots) {
    const ss = state.shots.find(x => x.number === shot.number)!;
    // Keyframe
    if (ss.image_status !== 'done') {
      const imgPrompt = withCores(shot.image_prompt, sb, shot.character_core_refs);
      const r = runLabgoogle(['image', 'gen', '--prompt', imgPrompt, '--out', dir, '--json'], 420);
      const img = (r?.images && r.images[0] && r.images[0].path) || r?.downloadedPath || '';
      if (r?.ok && img && fs.existsSync(img)) {
        const dest = `${dir}/keyframe-shot-${shot.number}.jpg`;
        try { fs.copyFileSync(img, dest); ss.image_path = dest; ss.image_status = 'done'; } catch { ss.image_path = img; ss.image_status = 'done'; }
      } else { ss.image_status = 'failed'; }
      saveState(stateFile, state);
    }
    // Video
    if (ss.video_status !== 'done' && ss.video_status !== 'blocked') {
      let vidPrompt = withCores(shot.video_prompt, sb, shot.character_core_refs);
      // ensure audio cues embedded for SFX-only native audio
      if (shot.audio) {
        const aud = [shot.audio.ambient ? `Ambient: ${shot.audio.ambient}.` : '', shot.audio.foley ? `SFX: ${shot.audio.foley}.` : '', shot.audio.spot_sfx ? `SFX: ${shot.audio.spot_sfx}.` : ''].filter(Boolean).join(' ');
        if (aud && !/Ambient:|SFX:/.test(vidPrompt)) vidPrompt += ` ${aud}`;
      }
      const vargs = ['flow', 'gen', '--project', project, '--prompt', vidPrompt, '--submit', '--timeout', '600000', '--json'];
      if (ss.image_status === 'done' && ss.image_path) { vargs.splice(4, 0, '--image', ss.image_path); }
      const r = runLabgoogle(vargs, 900);
      const vp = r?.downloadedPath || '';
      if (r?.ok && r?.rendered && vp && fs.existsSync(vp)) {
        const dest = `${dir}/shot-${shot.number}.mp4`;
        try { fs.copyFileSync(vp, dest); ss.video_path = dest; ss.video_status = 'done'; } catch { ss.video_path = vp; ss.video_status = 'done'; }
      } else {
        ss.retries++;
        if (ss.retries >= 2) { ss.video_status = 'blocked'; }
      }
      saveState(stateFile, state);
    }
    // Vocal (Vietnamese TTS) — no background music
    if (state.vocalLang && shot.audio && shot.audio.dialogue && ss.vocal_status !== 'done') {
      const voice = shot.audio.dialogue_voice || 'vi-VN-HoaiMyNeural';
      const vpath = `${dir}/vocal-shot-${shot.number}.mp3`;
      try {
        execFileSync('node', [TTS_SCRIPT, shot.audio.dialogue, '--voice', voice, '--output', vpath], { encoding: 'utf8', timeout: 90000 });
        if (fs.existsSync(vpath)) { ss.vocal_path = vpath; ss.vocal_status = 'done'; } else ss.vocal_status = 'failed';
      } catch { ss.vocal_status = 'failed'; }
      saveState(stateFile, state);
    }
  }
  state.step = 'assemble';
  saveState(stateFile, state);

  // ── Step 6: assemble — sequential concat (fix old loop/repeat bug) ──
  const doneShots = state.shots.filter(s => s.video_status === 'done' && fs.existsSync(s.video_path)).sort((a, b) => a.number - b.number);
  if (!doneShots.length) { console.log(JSON.stringify({ ok: false, stage: 'assemble', error: 'no rendered shots', dir })); process.exit(1); }

  // Normalize every clip to identical specs, then concat demuxer (true sequential, no loop)
  const normDir = `${dir}/norm`; fs.mkdirSync(normDir, { recursive: true });
  const normPaths: string[] = [];
  for (const s of doneShots) {
    const np = `${normDir}/n-${s.number}.mp4`;
    try {
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', s.video_path,
        '-vf', 'scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=24,setsar=1',
        '-c:v', 'libx264', '-preset', 'medium', '-crf', '19', '-pix_fmt', 'yuv420p',
        '-af', 'aresample=48000', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-video_track_timescale', '24000', np], { encoding: 'utf8', timeout: 180000 });
      if (fs.existsSync(np)) normPaths.push(np);
    } catch (e: any) { console.error(`[master] normalize shot ${s.number} failed: ${String(e?.message || e).slice(0, 120)}`); }
  }
  if (!normPaths.length) { console.log(JSON.stringify({ ok: false, stage: 'assemble-normalize', error: 'normalize failed', dir })); process.exit(1); }

  const listFile = `${dir}/concat-list.txt`;
  fs.writeFileSync(listFile, normPaths.map(p => `file '${p}'`).join('\n'));
  const rawPath = `${dir}/film-raw.mp4`;
  try {
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', '-movflags', '+faststart', rawPath], { encoding: 'utf8', timeout: 180000 });
  } catch {
    // fallback: re-encode concat
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c:v', 'libx264', '-crf', '19', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', rawPath], { encoding: 'utf8', timeout: 300000 });
  }
  state.film_raw = rawPath; saveState(stateFile, state);

  // ── Mux Vietnamese vocals over the concatenated film (no music) ──
  const vocals = state.shots.filter(s => s.vocal_status === 'done' && fs.existsSync(s.vocal_path)).sort((a, b) => a.number - b.number);
  let finalPath = `${dir}/film-final.mp4`;
  if (vocalLang && vocals.length) {
    // place each vocal at the cumulative start time of its shot
    const offsets: Record<number, number> = {};
    let acc = 0;
    for (const s of doneShots) { offsets[s.number] = acc; acc += probeDuration(s.video_path); }
    const inputs: string[] = ['-i', rawPath];
    const filters: string[] = [];
    const mixLabels: string[] = ['[0:a]'];
    vocals.forEach((v, idx) => {
      inputs.push('-i', v.vocal_path);
      const off = Math.max(0, Math.round((offsets[v.number] || 0) * 1000));
      filters.push(`[${idx + 1}:a]adelay=${off}|${off},volume=1.4[v${idx}]`);
      mixLabels.push(`[v${idx}]`);
    });
    const fc = `${filters.join(';')};${mixLabels.join('')}amix=inputs=${mixLabels.length}:duration=first:dropout_transition=0:normalize=0[mix]`;
    try {
      execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...inputs, '-filter_complex', fc, '-map', '0:v:0', '-map', '[mix]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', finalPath], { encoding: 'utf8', timeout: 300000 });
    } catch (e: any) {
      console.error(`[master] vocal mux failed, using raw as final: ${String(e?.message || e).slice(0, 150)}`);
      fs.copyFileSync(rawPath, finalPath);
    }
  } else {
    // SFX-only from Veo native audio, no music, no vocals to add
    fs.copyFileSync(rawPath, finalPath);
  }
  state.film_final = finalPath; state.step = 'done'; saveState(stateFile, state);

  const fi = fileInfo(finalPath);
  const dur = probeDuration(finalPath);
  const streams = probeStreams(finalPath);
  console.log(JSON.stringify({
    ok: fi.exists && streams.includes('video'),
    stage: 'done', film_final: finalPath, duration: dur, streams, fileInfo: fi,
    shots_total: sb.shots.length,
    shots_rendered: doneShots.length,
    shots_blocked: state.shots.filter(s => s.video_status === 'blocked').length,
    keyframes_done: state.shots.filter(s => s.image_status === 'done').length,
    vocals_done: vocals.length,
    no_music: noMusic,
    storyboard: `${dir}/storyboard.md`,
    dir,
  }));
}

main();
