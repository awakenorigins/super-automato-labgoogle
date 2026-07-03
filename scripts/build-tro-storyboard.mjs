#!/usr/bin/env node
// Authors the full 5-minute "Tro và chiếc bánh chưng đầu tiên" storyboard as a
// production-ready fallback JSON. Keeps character cores VERBATIM across all shots.
import fs from 'fs';

const DIR = process.argv[2] || '/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/master-phim-i-n-nh-5-ph-t-c-u-b-tro-v-chi-c-b-n';
fs.mkdirSync(DIR, { recursive: true });

const STYLE = 'Warm cinematic realism, Vietnamese Lunar New Year (Tết) countryside, shot on 35mm film look, soft natural light, gentle film grain, rich amber-and-jade color grade, shallow depth of field, photorealistic';

const TRO = 'Tro, a 6-year-old Vietnamese boy with a round sun-kissed face, big dark expressive eyes, short tousled black hair, a small gap-toothed smile, wearing a slightly oversized brown handwoven shirt and dark cotton trousers, barefoot, small delicate hands';
const BA = 'Bà (grandmother), a 68-year-old Vietnamese woman with a kind deeply-lined face, warm brown eyes, silver hair pulled into a low neat bun, wearing a faded indigo áo bà ba with a brown headscarf, thin gentle hands with prominent knuckles';

const VOICE_BA = 'vi-VN-HoaiMyNeural';
const VOICE_TRO = 'vi-VN-NamMinhNeural';

// helper to build a shot
let n = 0;
const shots = [];
function shot(o) {
  n += 1;
  const refs = o.refs || [];
  const coreText = refs.map(r => (r === 'Tro' ? TRO : r === 'Ba' ? BA : '')).filter(Boolean).join('. ');
  const img = `${STYLE}. ${o.size}, ${o.angle}. ${coreText ? coreText + '. ' : ''}${o.still}. ${o.context}. ${o.light}. ${o.mood}.`;
  const vid = `${o.size}. ${o.move}. ${coreText ? coreText + '. ' : ''}${o.action} ${o.context}. ${o.light}. ${STYLE}.` +
    (o.ambient ? ` Ambient: ${o.ambient}.` : '') + (o.sfx ? ` SFX: ${o.sfx}.` : '') +
    (o.dialogue ? ` The character says in Vietnamese: "${o.dialogue}".` : '');
  shots.push({
    number: n,
    act: o.act,
    scene_title: o.title,
    duration_seconds: o.dur || 8,
    shot_size: o.size,
    camera_angle: o.angle,
    camera_movement: o.move,
    lens: o.lens || '50mm',
    subject: refs.join(', '),
    action: o.action,
    context: o.context,
    lighting: o.light,
    mood_color: o.mood,
    audio: {
      ambient: o.ambient || '',
      foley: o.foley || '',
      spot_sfx: o.sfx || (o.silence ? 'total silence' : ''),
      dialogue: o.dialogue || null,
      dialogue_voice: o.dialogue ? (o.who === 'Tro' ? VOICE_TRO : VOICE_BA) : null,
    },
    transition_to_next: o.trans || 'Hard cut',
    image_prompt: img,
    video_prompt: vid,
    character_core_refs: refs,
    continuity_note: o.cont || '',
  });
}

// ─── ACT 1 — Setup (world, characters, plant) ───
shot({ act:1, title:'Bình minh làng quê ngày Tết', size:'EWS', angle:'High-angle', move:'Slow aerial drift forward over the village', lens:'24mm wide',
  refs:[], still:'A misty Vietnamese village at dawn, thatched roofs, a courtyard with a kumquat tree and red couplets',
  action:'Morning mist drifts over a quiet Vietnamese village; smoke rises from a kitchen chimney.',
  context:'rural North Vietnam, early Tết morning, rice fields in the distance', light:'Soft cool dawn light, golden rim on the mist', mood:'Peaceful, nostalgic, jade and amber',
  ambient:'distant rooster crow, soft wind, faint firecrackers far away', trans:'Dissolve', cont:'Opening establishing shot — will be mirrored by the final shot.' });

shot({ act:1, title:'Gian bếp của bà', size:'WS', angle:'Eye-level', move:'Slow dolly in through the doorway', refs:['Ba'],
  still:'sitting on a low wooden stool by a clay stove, laying out green dong leaves, soaked sticky rice, mung beans and pork on a bamboo tray',
  action:'Bà arranges leaves and rice on a bamboo tray, preparing to wrap bánh chưng.',
  context:'a warm dim traditional kitchen, red couplets on the wall, a small altar with kumquats', light:'Warm firelight from the stove, soft window light', mood:'Cozy, tender, warm amber',
  ambient:'crackling fire, water simmering', foley:'rustling dong leaves', trans:'Hard cut', cont:'Introduce Bà doing a characteristic action.' });

shot({ act:1, title:'Tro chạy vào', size:'MS', angle:'Eye-level', move:'Handheld follow', refs:['Tro'],
  still:'bursting through the doorway with excited wide eyes, cheeks flushed from running',
  action:'Tro runs in excitedly and skids to a stop beside Bà, eyes shining at the leaves and rice.',
  context:'the kitchen doorway, morning light behind him', light:'Backlit doorway glow, warm key on his face', mood:'Bright, eager, warm',
  ambient:'his quick footsteps, breathing', foley:'bare feet on packed earth floor', dialogue:'Bà ơi, năm nay cho con gói bánh với!', who:'Tro', trans:'Hard cut', cont:'Tro wants to help — establishes his desire (want).' });

shot({ act:1, title:'Bà mỉm cười gật đầu', size:'MCU', angle:'Eye-level', move:'Static', refs:['Ba'],
  still:'looking up with a soft warm smile, wrinkles deepening kindly around her eyes',
  action:'Bà looks up, smiles warmly and pats the stool beside her, inviting Tro to sit.',
  context:'by the clay stove, soft firelight', light:'Warm firelight glow on her face', mood:'Loving, patient, amber',
  ambient:'crackling fire', dialogue:'Được, con ngồi xuống đây bà chỉ cho.', who:'Ba', trans:'Hard cut', cont:'Bà accepts — the mentor bond established.' });

shot({ act:1, title:'Bàn tay bà đặt lá', size:'ECU', angle:'High-angle', move:'Static, slight rack focus', refs:['Ba'], dur:6,
  still:"Bà's thin wrinkled hands laying two dong leaves in a cross on the wooden board",
  action:"Bà's hands smooth two green dong leaves into a cross, pressing them flat with care.",
  context:'close on the wooden wrapping board', light:'Warm directional light, glistening leaf surface', mood:'Intimate, precise, jade green',
  foley:'leaves rustling, soft pat of hands', trans:'Match cut to Tro imitating', cont:'PLANT: the careful technique Tro will later fail then master.' });

// ─── ACT 2 — Confrontation (Tro tries, fails, is comforted, learns) ───
shot({ act:2, title:'Tro bắt chước', size:'MS', angle:'Eye-level', move:'Static', refs:['Tro'],
  still:'clumsily grabbing dong leaves, tongue poking out in concentration, leaves crooked',
  action:'Tro copies Bà, fumbling with the leaves, his tongue poking out as he concentrates hard.',
  context:'beside Bà at the wrapping board', light:'Warm firelight', mood:'Playful, determined, warm',
  ambient:'fire crackle', foley:'crinkling leaves', trans:'Hard cut', cont:'Tro attempts — clumsy.' });

shot({ act:2, title:'Đổ nếp quá tay', size:'CU', angle:'High-angle', move:'Slow push in', refs:['Tro'], dur:6,
  still:'small hands scooping too much sticky rice, grains spilling over the leaf edges',
  action:'Tro scoops far too much sticky rice; white grains spill over the leaf and scatter on the board.',
  context:'close on the overfilled leaf', light:'Warm light, rice grains catching highlights', mood:'Comic tension, warm',
  foley:'rice spilling, scattering grains', trans:'Hard cut', cont:'First mistake — overfilling.' });

shot({ act:2, title:'Gấp lá bị rách', size:'CU', angle:'Eye-level', move:'Static', refs:['Tro'], dur:6,
  still:'folding the leaf too hard, a tear splitting across the green surface',
  action:'Tro folds the leaf too forcefully and it tears, rice bulging out of the split.',
  context:'close on the tearing leaf in his hands', light:'Warm light', mood:'Deflating, tension, warm',
  foley:'a sharp leaf-tear rip', sfx:'small rip', trans:'Hard cut', cont:'Escalating failure.' });

shot({ act:2, title:'Bánh bung ra', size:'MCU', angle:'Eye-level', move:'Slight handheld', refs:['Tro'],
  still:'the half-wrapped bánh falling apart in his hands, rice and beans tumbling out',
  action:"Tro lifts his bánh and it collapses, rice and mung beans tumbling onto the board.",
  context:'over the messy board', light:'Warm light', mood:'Crushing disappointment, warm',
  foley:'soft tumble of rice and beans', trans:'Hard cut', cont:'The failure lands.' });

shot({ act:2, title:'Tro tủi thân', size:'CU', angle:'Slightly high-angle', move:'Slow push in', refs:['Tro'],
  still:'lower lip trembling, eyes welling with tears, looking down at the ruined bánh',
  action:'Tro\'s lip trembles and his eyes fill with tears as he stares at the ruined bánh.',
  context:'close on his crumpling face', light:'Soft warm light, a tear catching the glow', mood:'Heartbreaking, tender, warm', silence:true,
  ambient:'fire crackle only', trans:'Hold on silence', cont:'SILENCE beat #1 — emotional low.' });

shot({ act:2, title:'Giọt nước mắt rơi', size:'ECU', angle:'Eye-level', move:'Static', refs:['Tro'], dur:6,
  still:'a single tear rolling down his cheek and dropping onto a scattered grain of rice',
  action:'A single tear rolls down Tro\'s cheek and falls onto the scattered rice.',
  context:'extreme close on cheek and falling tear', light:'Soft rim light on the tear', mood:'Quiet sorrow, warm', silence:true,
  trans:'Hard cut', cont:'Show-don\'t-tell of his sadness.' });

shot({ act:2, title:'Bàn tay bà đặt lên vai', size:'MS', angle:'Eye-level', move:'Static', refs:['Ba','Tro'],
  still:'Bà gently placing a wrinkled hand on Tro\'s small shoulder, leaning close',
  action:'Bà gently rests her hand on Tro\'s shoulder and leans close with a soft reassuring smile.',
  context:'the two of them at the board', light:'Warm firelight wrapping both faces', mood:'Comforting, safe, amber',
  ambient:'fire crackle', dialogue:'Không sao đâu con. Bà hồi bé gói còn xấu hơn.', who:'Ba', trans:'Hard cut', cont:'Comfort — the need (reassurance) is met, not just the want.' });

shot({ act:2, title:'Tro ngẩng lên', size:'CU', angle:'Low-angle', move:'Static', refs:['Tro'], dur:6,
  still:'Tro looking up at Bà, tears still on his cheeks but a tiny hopeful spark returning',
  action:'Tro looks up at Bà, tears on his cheeks, a small hopeful spark returning to his eyes.',
  context:'looking up toward Bà', light:'Warm key from the stove', mood:'Fragile hope, warm',
  ambient:'fire crackle', trans:'Hard cut', cont:'Turn toward hope.' });

shot({ act:2, title:'Bà cầm tay Tro dạy', size:'CU', angle:'High-angle', move:'Slow dolly in', refs:['Ba','Tro'],
  still:"Bà's wrinkled hands cupping Tro's small hands, guiding them to fold the leaf gently",
  action:"Bà's hands cup Tro's small hands and guide them to fold the leaf slowly and gently together.",
  context:'close on four hands on the board', light:'Warm directional light on hands', mood:'Tender teaching, warm jade',
  foley:'soft rustle of leaves, gentle', trans:'Hard cut', cont:'PAYOFF of the technique plant (shot 5) — she teaches it.' });

shot({ act:2, title:'Gói lại từ từ', size:'MCU', angle:'Eye-level', move:'Static', refs:['Ba','Tro'],
  still:'Tro carefully wrapping again, slower, Bà nodding encouragement beside him',
  action:'Tro wraps again slowly and carefully while Bà nods and murmurs encouragement.',
  context:'the two working together', light:'Warm firelight', mood:'Focused, warming, amber',
  ambient:'fire crackle', foley:'careful leaf folds', dialogue:'Từ từ thôi con, đẹp lắm.', who:'Ba', trans:'Hard cut', cont:'Progress through patience.' });

shot({ act:2, title:'Buộc lạt', size:'ECU', angle:'High-angle', move:'Static', refs:['Tro'], dur:6,
  still:'small hands looping thin bamboo string around a lumpy but holding-together bánh',
  action:'Tro loops thin bamboo string around a lumpy bánh chưng that finally holds together.',
  context:'close on the tied bánh', light:'Warm light, string catching highlights', mood:'Small triumph, warm',
  foley:'string pulling taut', trans:'Hard cut', cont:'PLANT/PAYOFF: the imperfect but whole bánh — the film\'s key object.' });

shot({ act:2, title:'Tro nâng chiếc bánh méo', size:'MS', angle:'Low-angle', move:'Slow push in', refs:['Tro'],
  still:'Tro proudly holding up a small lumpy crooked bánh chưng with a gap-toothed grin',
  action:'Tro proudly lifts his small crooked bánh chưng, beaming a gap-toothed grin.',
  context:'in the warm kitchen', light:'Warm hero light on his face', mood:'Joyful pride, warm amber',
  ambient:'fire crackle', foley:'', dialogue:'Con gói được rồi bà ơi!', who:'Tro', trans:'Hard cut', cont:'The crooked bánh — will be the gift in Act 3.' });

// ─── Bridge — the night watch ───
shot({ act:2, title:'Nồi bánh trên bếp lửa', size:'WS', angle:'Eye-level', move:'Slow dolly back', refs:[],
  still:'a large blackened pot of bánh chưng boiling over a wood fire in the dark yard at night',
  action:'A big pot of bánh chưng boils over a crackling wood fire in the dark courtyard at night.',
  context:'the courtyard at New Year\'s Eve, stars above, red lantern glow', light:'Orange firelight against deep blue night', mood:'Warm against the cold night, amber and indigo',
  ambient:'crackling fire, bubbling water, crickets, distant firecrackers', trans:'Dissolve', cont:'Time shift to night watch.' });

shot({ act:2, title:'Bà và Tro ngồi canh nồi', size:'MWS', angle:'Eye-level', move:'Static', refs:['Ba','Tro'],
  still:'Bà and Tro sitting close on a low bench by the fire, wrapped in a shared blanket',
  action:'Bà and Tro sit close by the fire under a shared blanket, watching the pot boil.',
  context:'the night courtyard, firelight flickering on their faces', light:'Warm firelight, cool blue night behind', mood:'Intimate, peaceful, amber-indigo',
  ambient:'fire, crickets, distant firecrackers', trans:'Hard cut', cont:'Quiet bonding.' });

shot({ act:2, title:'Bà kể chuyện', size:'CU', angle:'Eye-level', move:'Slow push in', refs:['Ba'],
  still:'Bà speaking softly, eyes distant and warm with memory, firelight dancing on her face',
  action:'Bà speaks softly, her eyes warm with memory as firelight flickers across her face.',
  context:'by the fire at night', light:'Warm flickering firelight', mood:'Nostalgic, loving, amber',
  ambient:'fire crackle, crickets', dialogue:'Ngày xưa bà cũng ngồi canh nồi bánh với cụ, y như con bây giờ.', who:'Ba', trans:'Hard cut', cont:'Generational echo — deepens theme.' });

shot({ act:2, title:'Tro ngủ gật', size:'MCU', angle:'Slightly high-angle', move:'Static', refs:['Tro'],
  still:'Tro\'s eyelids drooping, head slowly nodding, then leaning onto Bà\'s shoulder asleep',
  action:'Tro\'s eyelids droop and his head nods until he leans asleep against Bà\'s shoulder.',
  context:'by the fire under the blanket', light:'Soft warm firelight', mood:'Tender, drowsy, warm', silence:true,
  ambient:'faint fire, crickets, soft breathing', trans:'Dissolve', cont:'SILENCE beat #2.' });

shot({ act:2, title:'Bà nhìn Tro ngủ', size:'CU', angle:'Eye-level', move:'Static', refs:['Ba'],
  still:'Bà looking down at the sleeping Tro with glistening loving eyes, gently pulling the blanket over him',
  action:'Bà gazes down at sleeping Tro with glistening eyes and gently tucks the blanket over him.',
  context:'firelit night', light:'Warm firelight, a soft catchlight of tears', mood:'Overwhelming tenderness, amber',
  ambient:'fire crackle, crickets', trans:'Fade to black', cont:'Emotional swell before Act 3.' });

// ─── ACT 3 — Resolution (morning, the gift, catharsis, mirror) ───
shot({ act:3, title:'Sáng mùng Một', size:'WS', angle:'Eye-level', move:'Slow dolly in', refs:[],
  still:'morning light flooding the courtyard, the cooled pot, bánh chưng stacked and drying',
  action:'Bright New Year morning light floods the courtyard; cooked bánh chưng rest stacked and cooling.',
  context:'the courtyard on New Year\'s Day morning, red couplets, kumquat tree', light:'Bright fresh golden morning light', mood:'Hopeful, fresh, warm gold',
  ambient:'birdsong, distant Tết music, firecrackers', trans:'Hard cut', cont:'New day, resolution begins.' });

shot({ act:3, title:'Tro tìm chiếc bánh méo', size:'MS', angle:'Eye-level', move:'Handheld follow', refs:['Tro'],
  still:'Tro searching the stack of bánh, carefully picking out his own lumpy crooked one',
  action:'Tro searches the stack and carefully lifts out his own lumpy crooked bánh chưng.',
  context:'by the stacked bánh in morning light', light:'Bright morning light', mood:'Eager, sweet, warm gold',
  ambient:'birdsong', foley:'shuffling leaves', trans:'Hard cut', cont:'PAYOFF: the crooked bánh returns.' });

shot({ act:3, title:'Tro dâng bánh cho bà', size:'MS', angle:'Low-angle', move:'Slow push in', refs:['Ba','Tro'],
  still:'Tro holding the crooked bánh up in both hands toward Bà, offering it with a shy proud smile',
  action:'Tro holds the crooked bánh up in both hands and offers it to Bà with a shy proud smile.',
  context:'in the bright courtyard', light:'Warm golden morning light on both', mood:'Loving, climactic, warm gold',
  ambient:'birdsong, faint firecrackers', dialogue:'Con tặng bà chiếc bánh đầu tiên con gói.', who:'Tro', trans:'Hard cut', cont:'CLIMAX — the gift.' });

shot({ act:3, title:'Bà nhận bánh', size:'CU', angle:'Eye-level', move:'Static', refs:['Ba'],
  still:'Bà taking the crooked bánh in her wrinkled hands, looking down at it, eyes welling up',
  action:'Bà takes the crooked bánh in her hands, looks down at it and her eyes brim with tears.',
  context:'morning courtyard', light:'Soft golden light, tears catching the glow', mood:'Overwhelmed with joy, warm gold', silence:true,
  ambient:'faint birdsong', trans:'Hold', cont:'SILENCE beat #3 — the payoff of the whole film.' });

shot({ act:3, title:'Nước mắt hạnh phúc của bà', size:'ECU', angle:'Eye-level', move:'Static', refs:['Ba'], dur:6,
  still:'a happy tear rolling down Bà\'s wrinkled cheek as a trembling smile forms',
  action:'A happy tear rolls down Bà\'s wrinkled cheek as a trembling smile spreads across her face.',
  context:'extreme close on her face', light:'Soft golden rim light on the tear', mood:'Cathartic joy, warm gold',
  ambient:'faint birdsong', trans:'Hard cut', cont:'Nước mắt — the emotional peak (payoff of Tro\'s tear in Act 2).' });

shot({ act:3, title:'Bà ôm Tro', size:'MS', angle:'Eye-level', move:'Slow dolly in', refs:['Ba','Tro'],
  still:'Bà pulling Tro into a warm embrace, both laughing and crying, the crooked bánh between them',
  action:'Bà pulls Tro into a warm embrace; both laugh and cry as the crooked bánh rests between them.',
  context:'the bright courtyard', light:'Warm golden morning light', mood:'Joyful catharsis, warm gold',
  ambient:'birdsong, distant Tết music, firecrackers', dialogue:'Đây là chiếc bánh ngon nhất bà từng có.', who:'Ba', trans:'Dissolve', cont:'Nụ cười + nước mắt together — the film\'s heart.' });

shot({ act:3, title:'Chiếc bánh méo trên bàn thờ', size:'CU', angle:'Eye-level', move:'Slow push in', refs:[], dur:6,
  still:'the small crooked bánh chưng placed with pride at the center of the family ancestral altar among perfect ones',
  action:'The small crooked bánh is placed with pride at the center of the ancestral altar among the perfect ones.',
  context:'the family altar with incense, kumquats, red couplets', light:'Warm candlelight and incense smoke', mood:'Reverent, warm, amber gold',
  ambient:'soft crackle of incense, distant Tết music', trans:'Dissolve', cont:'The imperfect bánh honored — theme resolved.' });

shot({ act:3, title:'Bình minh làng quê — khép lại', size:'EWS', angle:'High-angle', move:'Slow aerial drift back', lens:'24mm wide', refs:[],
  still:'the same misty village at morning, now with warm golden light and rising kitchen smoke, life stirring',
  action:'The same village, now in warm golden morning light, smoke rising, life gently stirring for the new year.',
  context:'rural North Vietnam, New Year\'s Day morning, rice fields glowing', light:'Warm golden morning light over the mist', mood:'Full-circle warmth, hopeful, amber gold',
  ambient:'birdsong, distant Tết music and firecrackers, gentle wind', trans:'Fade to black', cont:'MIRROR of opening shot 1 — same frame, meaning transformed from quiet to full of love.' });

const total = shots.reduce((a, s) => a + s.duration_seconds, 0);
const sb = {
  title: 'Tro and the First Bánh Chưng',
  total_duration_seconds: total,
  style: STYLE,
  characters: [
    { name: 'Tro', core: TRO, voice: VOICE_TRO, voice_desc: 'young cheerful 6-year-old boy' },
    { name: 'Ba', core: BA, voice: VOICE_BA, voice_desc: 'warm gentle elderly grandmother' },
  ],
  shots,
};
fs.writeFileSync(`${DIR}/storyboard.fallback.json`, JSON.stringify(sb, null, 2));
console.log(JSON.stringify({ ok: true, shots: shots.length, total_seconds: total, dir: DIR, dialogue_shots: shots.filter(s => s.audio.dialogue).length, silence_shots: shots.filter(s => s.audio.spot_sfx === 'total silence').length }));
