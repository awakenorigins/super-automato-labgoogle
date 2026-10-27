# Cinematic AI Filmmaking — Practical Knowledge Base
> Chưng cất từ Google Veo/Flow docs, Google Cloud Blog, DeepMind prompt guide, nofilmschool, studiobinder, Reddit r/aivideo, filmmaker blogs. Ngày tổng hợp: 2026-07-03.

---

## A. CẤU TRÚC PROMPT VEO / CINEMATIC AI

### A1. Anatomy — Prompt Video Chuẩn (thứ tự tối ưu)

Công thức chính thức từ Google Cloud Blog (Veo 3.1 Prompting Guide):

```
[CINEMATOGRAPHY] + [SUBJECT] + [ACTION] + [CONTEXT] + [STYLE & AMBIANCE]
```

Mở rộng chi tiết (11 thành phần):

| # | Thành phần | Mô tả | Ví dụ |
|---|-----------|-------|-------|
| 1 | **Shot size** | Kích thước khung hình | `Medium shot`, `Extreme close-up` |
| 2 | **Camera angle** | Góc máy | `Low-angle`, `Eye-level`, `Bird's eye view` |
| 3 | **Camera movement** | Chuyển động camera | `Slow dolly in`, `Tracking shot following...` |
| 4 | **Lens/Focal** | Ống kính, hiệu ứng quang học | `Shallow depth of field, 50mm lens, soft bokeh` |
| 5 | **Subject** | Nhân vật/vật thể chính | `A tired corporate worker in his 40s` |
| 6 | **Action** | Hành động đang diễn ra | `rubbing his temples in exhaustion` |
| 7 | **Context/Location** | Bối cảnh, không gian, thời gian | `in a cluttered 1980s office, late at night` |
| 8 | **Lighting** | Nguồn sáng, tính chất ánh sáng | `Harsh fluorescent overhead + green glow from monitor` |
| 9 | **Mood/Color** | Tâm trạng, bảng màu, color grade | `Melancholic mood, cool blue tones` |
| 10 | **Film stock/Look** | Phong cách hình ảnh | `Retro aesthetic, shot on 1980s color film, slightly grainy` |
| 11 | **Audio cues** | Âm thanh (Veo 3+ hỗ trợ native audio) | `SFX: thunder cracks. Ambient: quiet hum of starship` |

**Quy tắc vàng:**
- ✅ **Đặt camera info ĐẦU prompt** — giúp AI frame mọi thứ đúng
- ✅ **Một hành động/prompt** — tối ưu cho clip < 10s
- ✅ **Positive phrasing** — mô tả CÁI MUỐN, không phải cái không muốn ("smooth stable camera" thay vì "no camera shake")
- ✅ **Tách câu camera movement khỏi subject action** — "The camera pulls back slowly." là câu riêng
- ✅ **Dialogue dùng ngoặc kép** — `A woman says, "We have to leave now."`
- ✅ **SFX/Ambient ghi riêng** — `SFX: thunder cracks in the distance. Ambient noise: rain on tin roof.`

### A2. Từ khóa Camera Movement

| Loại | Từ khóa prompt | Hiệu ứng |
|------|---------------|-----------|
| **Dolly** | `Dolly in`, `Push in`, `Pull out`, `Dolly out` | Camera di chuyển VẬT LÝ đến/rời subject. Tạo tension (in) hoặc reveal (out) |
| **Tracking/Truck** | `Tracking shot`, `Truck left`, `Truck right` | Theo chân subject di chuyển, hoặc di chuyển ngang song song |
| **Pan** | `Pan left`, `Pan right`, `Slow pan` | Xoay camera ngang từ vị trí cố định. Reveal không gian |
| **Tilt** | `Tilt up`, `Tilt down` | Xoay camera dọc. Nhấn chiều cao/kích thước |
| **Crane** | `Crane up`, `Crane down`, `Pedestal up/down` | Di chuyển camera THẲNG ĐỨNG. Tạo epic scale, awe |
| **Orbit** | `Orbit shot`, `Arc shot`, `180-degree arc` | Vòng quanh subject. Tạo chiều sâu 3D, dramatic reveal |
| **Handheld** | `Handheld`, `Slight sway` | Rung nhẹ tự nhiên. Documentary feel, intimacy |
| **Static** | `Static shot`, `Locked-off camera` | Cố định. Sự tĩnh lặng, contemplation |
| **Zoom** | `Smooth zoom in`, `Slow zoom out` | Thay đổi focal length (khác dolly). Ít cinematic hơn dolly |
| **Aerial** | `Aerial view`, `Drone orbit`, `Bird's eye` | Từ trên cao. Reveal landscape, scale |
| **POV** | `POV shot`, `First-person perspective` | Góc nhìn nhân vật. Immersion |

### A3. Shot Size Reference

| Viết tắt | Tên | Frame gì | Dùng khi |
|----------|-----|----------|----------|
| **ECU** | Extreme Close-Up | Chi tiết nhỏ (mắt, tay run) | Emotion cực đại, detail quan trọng |
| **CU** | Close-Up | Mặt | Emotion, reaction, intimacy |
| **MCU** | Medium Close-Up | Từ ngực lên | Hội thoại, kết nối |
| **MS** | Medium Shot | Từ thắt lưng lên | Dialogue chuẩn, balance detail + context |
| **MWS** | Medium Wide Shot | Từ đầu gối lên | Action + environment |
| **WS** | Wide Shot / Long Shot | Toàn thân + môi trường | Establish context, subject trong không gian |
| **EWS** | Extreme Wide Shot | Nhân vật nhỏ trong landscape khổng lồ | Establishing shot, epic scale, isolation |

### A4. Camera Angle

| Angle | Prompt keyword | Hiệu ứng tâm lý |
|-------|---------------|-------------------|
| **Eye-level** | `Eye-level shot` | Trung lập, quen thuộc |
| **Low-angle** | `Low-angle shot` | Subject mạnh mẽ, quyền uy, đe dọa |
| **High-angle** | `High-angle shot` | Subject nhỏ bé, yếu đuối, vulnerable |
| **Dutch/Canted** | `Dutch angle`, `Tilted frame` | Bất ổn, derangement, tension |
| **Overhead** | `Top-down`, `Bird's eye view`, `Overhead` | Pattern, scale, detached perspective |

### A5. Continuity Giữa Các Shot

**Vấn đề cốt lõi:** Mỗi clip Veo gen RIÊNG BIỆT — không có "memory" giữa các lần gen.

**Giải pháp thực chiến:**

1. **Master Character Sheet:**
   - Gen 1 ảnh reference chất lượng cao: front-facing, neutral pose, even lighting
   - Gen thêm ảnh từ nhiều góc (3/4 left, 3/4 right, profile) + nhiều biểu cảm
   - Ghép thành 1 "turnaround sheet" → dùng làm reference image cho MỌI clip

2. **Character Core Description — viết 1 lần, copy-paste mọi prompt:**
   ```
   [CHARACTER CORE] A Vietnamese woman in her late 20s, oval face, warm brown 
   eyes, shoulder-length black hair with slight wave, wearing a cream-colored 
   linen blouse and dark navy pants. Slender build, gentle posture.
   ```

3. **Dùng ĐÚng từ khóa y hệt** — "cream linen blouse" MỌI lần, không đổi thành "off-white shirt"

4. **Last-frame → First-frame chaining:**
   - Extract frame cuối clip N → dùng làm reference image cho clip N+1
   - Veo 3.1 hỗ trợ "First and Last Frame" feature → gen transition tự nhiên giữa 2 ảnh

5. **Giữ nhất quán: lighting + color grade + film look** qua mọi prompt

6. **Gen clip ngắn 4-6s** (ít bị drift hơn 8s) → ghép trong post

7. **Batch tương tự:** Gen các shot cùng scene liên tiếp, khi model "warm"

### A6. Negative Prompt / Tránh Gì

- **Veo khuyến khích positive phrasing.** Thay vì "no buildings", viết "a desolate landscape with only sand dunes"
- **Tránh prompt quá ngắn/chung chung** — "a dog running" → output generic. Thêm chi tiết.
- **Tránh nhiều action phức tạp trong 1 prompt** — 1 action/prompt
- **Tránh chỉ dẫn mâu thuẫn** — "static camera" + "tracking shot" cùng lúc
- **Tránh kỳ vọng lip-sync hoàn hảo cho dialogue dài** — Veo 3 tốt nhưng có giới hạn

### A7. Timestamp Prompting (Veo 3.1 Advanced)

Veo 3.1 cho phép **multi-shot sequence trong 1 lần gen** bằng timestamp:

```
[00:00-00:02] Medium shot from behind a young explorer, pushes aside a jungle vine 
to reveal a hidden path.
[00:02-00:04] Reverse shot of the explorer's face, expression filled with awe as 
she gazes upon ancient, moss-covered ruins. SFX: Rustle of leaves, distant bird calls.
[00:04-00:06] Tracking shot following the explorer as she runs her hand over intricate 
carvings on a crumbling stone wall.
[00:06-00:08] Wide shot pulling back to reveal the full scale of the ancient temple 
complex, overgrown with vines. SFX: Wind through ruins.
```

**Lợi ích:** Giữ consistency visual trong 1 clip dài, thay vì gen 4 clip riêng.

---

## B. STORYBOARD CHO PHIM AI

### B1. Vì Sao Storyboard-First Quan Trọng

- **AI không đoán ý bạn** — Không storyboard = mỗi clip gen random → mất continuity
- **Tiết kiệm credit/tiền** — Mỗi lần gen sai = phí token. Storyboard giúp gen đúng từ đầu
- **Kiểm soát nhịp phim** — Biết trước clip nào 4s, 6s, 8s → tính tổng thời lượng
- **Thống nhất vision** — Cả team cùng hiểu shot, mood, arc TRƯỚC khi bấm gen

### B2. Mỗi Khung Hình Storyboard = 1 Card

Template cho mỗi storyboard frame:

```yaml
FRAME: 07
SCENE: 3 — "Nhận ra sự thật"
SHOT SIZE: Close-up
CAMERA ANGLE: Eye-level
CAMERA MOVE: Slow push-in
LENS: 85mm, shallow DOF
SUBJECT: Nhân vật chính, mắt mở to, nước mắt rơi
ACTION: Nhìn thẳng vào camera, tay nắm chặt lá thư
CONTEXT: Phòng khách cũ, ánh chiều vàng xuyên qua rèm
LIGHTING: Warm golden hour, side-lit, deep shadows
MOOD: Heartbreak, revelation, quiet devastation
AUDIO: Silence — chỉ tiếng đồng hồ ticking chậm
DURATION: 6s
REF IMAGE: keyframe_07.png
TRANSITION TO NEXT: Hard cut to Frame 08 (contrast shift)
```

### B3. Reference Image Workflow — "Ingredients to Video"

**Veo 3.1 hỗ trợ tối đa 3 reference images/lần gen (Ingredients to Video):**

| Slot | Vai trò | Ví dụ |
|------|---------|-------|
| Image 1 | **Character/Subject** | Ảnh nhân vật chính, front-facing, rõ mặt + outfit |
| Image 2 | **Scene/Environment** | Ảnh background/location (phòng khách, bãi biển...) |
| Image 3 | **Style/Texture** | Ảnh mẫu color grade, film look, art direction |

**First-Frame + Last-Frame (Frames-to-Video):**
- Cung cấp 2 ảnh: ảnh đầu + ảnh cuối
- Veo gen VIDEO TRANSITION tự nhiên giữa 2 ảnh
- Dùng cho: morph, camera movement, transformation
- **Hạn chế:** Veo 3.1 GA hỗ trợ 1-2 ảnh cho mode first+last frame

### B4. Pipeline Hoàn Chỉnh: Script → Clip

```
SCRIPT/STORYLINE
    ↓
SHOT LIST (mỗi shot = shot size + angle + movement + description)
    ↓
STORYBOARD (mỗi frame = shot card template B2 + sketch/AI-gen keyframe)
    ↓
KEYFRAME IMAGES (gen bằng Gemini 2.5 Flash Image / Midjourney / Flux)
    ↓
CHARACTER REFERENCE SHEET (turnaround + expressions)
    ↓
VIDEO CLIP GEN (Veo 3.1 — mỗi clip 4-8s, dùng keyframe + ref images)
    ↓
REVIEW & RE-GEN (check continuity, re-gen nếu drift)
    ↓
POST-PRODUCTION (ffmpeg concat + audio + color)
    ↓
FINAL FILM
```

### B5. Storyboard Tools Đề Xuất

| Tool | Vai trò | Ghi chú |
|------|---------|---------|
| **Boords AI** | Script → storyboard tự động | Có collaboration |
| **Storyboarder.ai** | AI storyboard generator | Free tier |
| **ShotKraft** | Shot list generator từ script | 30+ production params |
| **Gemini 2.5 Flash Image** | Gen keyframe ảnh từ text | Dùng trực tiếp với Veo workflow |

---

## C. KỊCH BẢN CHẠM TIM / ĐIỆN ẢNH

### C1. Show Don't Tell — Thực Hành Cụ Thể

| ❌ TELL (tránh) | ✅ SHOW (dùng cái này) |
|-----------------|----------------------|
| Narration: "Cô ấy rất buồn" | CU: Tay run rẩy cầm tách trà, mắt nhìn xa xăm ra cửa sổ mưa |
| Narration: "Anh ấy sợ hãi" | ECU: Giọt mồ hôi lăn trên thái dương, mắt mở to nhìn vào bóng tối |
| Subtitle: "10 năm đã trôi qua" | WS: Cùng góc camera, cùng cái cây — nhưng cây giờ cao lớn, tóc người bạc trắng |
| Dialogue: "Tôi yêu con" | MS: Cha lặng lẽ đắp chăn cho con ngủ, xoa đầu rồi đứng nhìn, ánh đèn hành lang |

**Nguyên tắc:** Khi hình ảnh và lời nói mâu thuẫn → hình ảnh THẮNG. Tin vào sức mạnh của visual.

### C2. Cấu Trúc Cảm Xúc — 3-Act cho Phim AI Ngắn

Vì clip AI ngắn (1-3 phút), nén 3-act:

```
ACT 1 — SETUP (20-25% thời lượng)
├── Establish world: 1-2 WS/EWS cho context
├── Introduce character: MS/CU cho nhân vật chính
├── Plant the seed: 1 detail nhỏ sẽ payoff ở cuối
└── Inciting incident: Sự kiện thay đổi mọi thứ

ACT 2 — CONFRONTATION (50% thời lượng)
├── Rising tension: Obstacles tăng dần
├── Midpoint shift: Twist/revelation
├── Emotional deepening: CU reactions, internal struggle
└── All seems lost: Điểm thấp nhất

ACT 3 — RESOLUTION (25-30% thời lượng)
├── Climax: Hành động/quyết định quyết định
├── Payoff: Detail từ Act 1 quay lại
├── Catharsis: Khoảnh khắc cảm xúc đỉnh
└── Final image: Mirror hoặc contrast với opening
```

### C3. Tâm Lý Nhân Vật

| Yếu tố | Giải thích | Ví dụ |
|---------|-----------|-------|
| **WANT** (mong muốn bề mặt) | Điều nhân vật NGHĨ mình cần | Muốn thăng chức, muốn giàu |
| **NEED** (nhu cầu sâu xa) | Điều nhân vật THỰC SỰ cần | Cần được cha công nhận, cần tha thứ chính mình |
| **ARC** | Hành trình từ want → nhận ra need | Từ đuổi theo thành công → hiểu family là tất cả |
| **SUBTEXT** | Điều KHÔNG NÓI nhưng hiểu | Hai người yêu cũ nói chuyện thời tiết — thực ra đang nói lời từ biệt |

**Cách thể hiện trong prompt AI:**
- Không ghi "character feels conflicted"
- Ghi: "Character clenches jaw, looks away, fingers tightening around the edge of the table"

### C4. Nhịp Phim (Pacing) cho AI Film

```
NHỊP NHANH (tension, urgency):
- Cut nhanh: clip 4s liên tiếp
- Handheld, slight sway
- ECU → CU → MS quick alternation
- SFX: heartbeat, ticking, heavy breathing

KHOẢNG LẶNG (emotional weight):
- Static shot, 6-8s
- WS hoặc CU held lâu
- Silence hoặc chỉ ambient
- Let the viewer FEEL, không rush

BUILD-UP → CAO TRÀO:
1. Bắt đầu WS tĩnh, nhẹ nhàng
2. Tăng dần: MCU → CU, camera moves closer
3. Tốc độ cut tăng
4. SFX layers tăng
5. ĐỈNH: ECU + moment of silence trước impact
6. CAO TRÀO: 1 shot decisive
7. GIẢI THOÁT: Pull back to WS, quiet
```

### C5. Bittersweet / Payoff — Cách Lấy "Nụ Cười + Nước Mắt"

| Kỹ thuật | Cách làm |
|----------|---------|
| **Plant & Payoff** | Act 1: Cài chi tiết nhỏ (con gấu bông, bài hát, câu nói). Act 3: Chi tiết đó quay lại với ý nghĩa mới |
| **Contrast** | Cảnh vui → cut hard sang cảnh buồn. Hoặc ngược lại: buồn → bất ngờ ấm áp |
| **Bittersweet ending** | Nhân vật ĐƯỢC điều cần (need) nhưng MẤT điều muốn (want). Hoặc ngược lại |
| **Mirror/Bookend** | Shot cuối = shot đầu, nhưng ý nghĩa hoàn toàn khác sau hành trình |
| **Silent beat** | Sau cao trào, 3-5s tĩnh lặng hoàn toàn. Để cảm xúc thấm |

---

## D. THỰC CHIẾN KỸ THUẬT GHÉP PHIM AI DÀI

### D1. Ghép Nhiều Clip → Phim Liền Mạch

**Bước 1: Chuẩn hóa specs TRƯỚC khi concat**
```bash
# Kiểm tra specs từng clip
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,sample_rate -of json clip_01.mp4

# Re-encode tất cả về cùng specs nếu cần
for f in clip_*.mp4; do
  ffmpeg -i "$f" -c:v libx264 -preset slow -crf 18 \
    -vf "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2" \
    -r 24 -c:a aac -ar 48000 -b:a 192k "normalized_${f}"
done
```

**Bước 2A: Concat Demuxer (nhanh, không re-encode — PHẢI cùng specs)**
```bash
# Tạo file list
ls normalized_clip_*.mp4 | sort -V | sed "s/^/file '/" | sed "s/$/'/" > filelist.txt

# Concat
ffmpeg -f concat -safe 0 -i filelist.txt -c copy output_film.mp4
```

**Bước 2B: Concat Filter (linh hoạt, re-encode — khác specs OK)**
```bash
ffmpeg -i clip_01.mp4 -i clip_02.mp4 -i clip_03.mp4 \
  -filter_complex \
    "[0:v]setpts=PTS-STARTPTS[v0]; \
     [1:v]setpts=PTS-STARTPTS[v1]; \
     [2:v]setpts=PTS-STARTPTS[v2]; \
     [0:a]asetpts=PTS-STARTPTS[a0]; \
     [1:a]asetpts=PTS-STARTPTS[a1]; \
     [2:a]asetpts=PTS-STARTPTS[a2]; \
     [v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[outv][outa]" \
  -map "[outv]" -map "[outa]" -c:v libx264 -crf 18 -c:a aac output.mp4
```

**Bước 3: Crossfade Transition (xfade)**
```bash
# Crossfade 0.5s giữa 2 clip
ffmpeg -i clip_01.mp4 -i clip_02.mp4 \
  -filter_complex \
    "[0:v]setpts=PTS-STARTPTS[v0]; \
     [1:v]setpts=PTS-STARTPTS[v1]; \
     [v0][v1]xfade=transition=fade:duration=0.5:offset=7.5[outv]; \
     [0:a][1:a]acrossfade=d=0.5[outa]" \
  -map "[outv]" -map "[outa]" output.mp4
```

**Bước 4: Xử lý clip KHÔNG CÓ audio (Veo đôi khi gen mute)**
```bash
# Thêm silent audio track cho clip mute trước khi concat
ffmpeg -i silent_clip.mp4 -f lavfi -i anullsrc=r=48000:cl=stereo \
  -shortest -c:v copy -c:a aac clip_with_silence.mp4
```

### D2. Transition Types cho Match Cut

| Transition | ffmpeg xfade value | Khi nào dùng |
|-----------|-------------------|---------------|
| **Hard cut** | (không dùng xfade) | Hầu hết cuts. Đổi góc, đổi scene |
| **Dissolve** | `transition=dissolve` | Passage of time, dream sequence |
| **Fade to black** | `transition=fade` | End of scene/act, heavy emotional beat |
| **Wipe** | `transition=wipeleft` | Stylistic choice, thay đổi location |
| **Match cut** | Hard cut + visual match | Cùng composition/movement, khác scene (cần plan trong storyboard) |

**Match cut = creative decision, KHÔNG phải filter.** Bạn plan 2 shot có visual similarity (cùng shape, movement, position) rồi hard cut giữa chúng.

### D3. Vietnamese Voiceover / TTS + Lip-Sync

**Pipeline thêm voice tiếng Việt:**

```
1. VIẾT SCRIPT THOẠI → timing cho từng câu theo clip
2. GEN VOICE (chọn 1):
   ├── ElevenLabs (Vietnamese) — chất lượng cao, voice cloning
   ├── edge-tts — free, nhiều voice VN (vi-VN-HoaiMyNeural, vi-VN-NamMinhNeural)
   ├── Narakeet — xử lý thanh điệu tiếng Việt tốt
   └── Google Cloud TTS — ổn định, API dễ dùng
3. SYNC AUDIO VỚI VIDEO:
   ffmpeg -i video.mp4 -i voiceover.wav \
     -c:v copy -c:a aac -map 0:v -map 1:a \
     -shortest output_with_voice.mp4
4. (Optional) LIP-SYNC:
   ├── HeyGen — voice cloning + lip-sync tự động
   ├── Rask AI — lip-sync cho video đã có
   └── Kapwing — AI dubbing + lip-sync
```

**Thực tế:** Lip-sync tiếng Việt chưa hoàn hảo ở bất kỳ tool nào. Workaround:
- Dùng voiceover THAY vì dialogue trực tiếp (narrator style)
- Hoặc gen clip Veo với dialogue English → dub Vietnamese bằng Rask/HeyGen
- Hoặc tránh shot CU miệng khi có dialogue — dùng MS/WS hoặc cut-away

### D4. SFX Layering — Không Nhạc Nền

**Triết lý:** Nhạc nền = "cheat code" cảm xúc. Khi BỎ nhạc nền, buộc bạn tạo cảm xúc thật bằng hình ảnh + âm thanh diegetic → mạnh hơn.

**3 layers SFX:**

| Layer | Ví dụ | Vai trò |
|-------|-------|---------|
| **Ambient** (nền) | Tiếng gió, mưa, traffic xa xa, hum máy lạnh | Establish world, grounding |
| **Foley** (hành động) | Bước chân, tiếng giấy, cốc đặt xuống bàn, vải áo sột soạt | Realism, presence |
| **Spot SFX** (đặc biệt) | Cửa đóng sầm, tiếng vỡ, heartbeat, tiếng đồng hồ | Punctuation, emotional emphasis |

**Kỹ thuật silence = power:**
- Trước cao trào: CẮT HẾT SFX → 1-2s im lặng tuyệt đối → IMPACT
- Sau cao trào: Ambient nhẹ dần dần trở lại → grounding
- Veo 3.1 có thể gen audio theo prompt: `"Ambient: complete silence except distant wind"`

**ffmpeg mix nhiều audio track:**
```bash
# Mix 3 audio layers (ambient + foley + spot SFX) lên video
ffmpeg -i video.mp4 -i ambient.wav -i foley.wav -i spot_sfx.wav \
  -filter_complex \
    "[1:a]volume=0.3[amb]; \
     [2:a]volume=0.7[fol]; \
     [3:a]volume=1.0[sfx]; \
     [amb][fol][sfx]amix=inputs=3:duration=longest[mixed]" \
  -map 0:v -map "[mixed]" -c:v copy -c:a aac output_layered.mp4
```

### D5. Nguồn SFX Miễn Phí

| Nguồn | URL | Ghi chú |
|-------|-----|---------|
| Freesound.org | freesound.org | CC license, thư viện lớn |
| Pixabay Audio | pixabay.com/sound-effects | Miễn phí thương mại |
| BBC Sound Effects | sound-effects.bbcrewind.co.uk | 33,000+ sounds, personal use |
| Veo 3.1 native audio | (gen cùng video) | Gen SFX trực tiếp theo prompt |

---

## PROMPT TEMPLATES

### Template 1: Storyboard Frame Prompt (cho gen keyframe ảnh)

```
[SHOT SIZE] [CAMERA ANGLE] of [SUBJECT with detailed appearance],
[ACTION/POSE], in [LOCATION with specific details],
[TIME OF DAY]. [LIGHTING description].
[MOOD/EMOTION]. [COLOR PALETTE/FILM LOOK].
Style: [cinematic/photorealistic/specific film reference].
--no [things to avoid]
```

**Ví dụ:**
```
Medium close-up, eye-level of a Vietnamese woman in her late 20s 
with shoulder-length black hair, wearing a cream linen blouse,
holding a folded letter to her chest with both hands,
in a dimly lit living room with old wooden furniture,
late afternoon. Warm golden hour light streaming through lace curtains,
creating long shadows. Bittersweet, contemplative mood.
Desaturated warm tones with amber highlights.
Style: cinematic, shot on Kodak Portra 400 film stock.
```

### Template 2: Video Clip Prompt (Veo 3.1)

```
[SHOT SIZE], [CAMERA MOVEMENT description as separate sentence].
[SUBJECT with consistent character description from master sheet],
[ACTION with kinetic verbs].
[LOCATION/CONTEXT with specific environmental details].
[LIGHTING and time of day].
[STYLE/FILM LOOK].
[AUDIO CUES — dialogue in quotes, SFX:, Ambient:]
```

**Ví dụ:**
```
Close-up. The camera slowly dollies in toward the subject's face.
A Vietnamese woman in her late 20s with shoulder-length black hair 
and a cream linen blouse, her eyes welling with tears as she reads 
a handwritten letter, her fingers trembling slightly.
A dimly lit living room with old wooden furniture, late afternoon,
warm golden hour light streaming through lace curtains.
Cinematic, shot on film, warm desaturated tones.
Ambient: quiet hum of an old ceiling fan, distant traffic.
SFX: The soft rustle of paper as she unfolds the letter.
```

### Template 3: Emotional Scene — Bittersweet Moment

```
SETUP SHOT (clip 1, 6s):
Wide shot, static camera. [Character] sits alone at [location],
[small habitual action]. [Warm but lonely atmosphere].
Ambient: [environmental sounds only, no music].

TENSION SHOT (clip 2, 4s):
Medium shot. Slow push-in. [Character] notices [the trigger object/person].
[Reaction: freeze, breath catches, hand movement].
SFX: [sudden quiet — ambient drops to near-silence].

EMOTIONAL PEAK (clip 3, 6s):
Close-up. Static shot held. [Character's face — the real emotion].
[Tears? Smile? Both?] [The detail from Act 1 returns with new meaning].
Complete silence for 2 seconds, then: [one specific ambient sound returns].

RESOLUTION (clip 4, 8s):
Wide shot, slow crane up or pull-out. [Character in context — smaller now].
[Final action: acceptance, release, a small gesture].
Ambient: [full environmental soundscape returns, gentle].
```

---

## VEO/FLOW HARD LIMITS

| Thông số | Giá trị | Nguồn | Độ tin cậy |
|----------|---------|-------|------------|
| **Clip length** | 4, 6, hoặc 8 giây | Google Cloud Docs (Veo 3.1 GA) | ✅ Chắc chắn |
| **Clip length (ref image → video)** | Chỉ 8 giây | Google Cloud Docs (Veo 3.1) | ✅ Chắc chắn |
| **Output resolution** | 720p hoặc 1080p | Google Cloud Docs (Veo 3.1 GA) | ✅ Chắc chắn |
| **Framerate** | 24 FPS | Google Cloud Docs (Veo 3.1 GA) | ✅ Chắc chắn |
| **Aspect ratio** | 16:9, 9:16 | Google Cloud Docs (Veo 3.1 GA) | ✅ Chắc chắn |
| **Max output videos/prompt** | 4 videos | Google Cloud Docs (Veo 3.1 GA) | ✅ Chắc chắn |
| **Input image max size** | 20 MB | Google Cloud Docs (Veo 3.1 GA) | ✅ Chắc chắn |
| **Reference images (Ingredients)** | Tối đa 3 ảnh | Google Blog + search results | ⚠️ Cao (nhiều nguồn xác nhận) |
| **First+Last frame images** | 1-2 ảnh | Google Cloud Docs | ✅ Chắc chắn |
| **Prompt language** | English (chính thức) | Google Cloud Docs | ✅ Chắc chắn |
| **Prompt token limit** | 2000 tokens | Third-party API docs (piapi, evolink) | ⚠️ Trung bình (chưa từ Google chính thức) |
| **Video extend** | 7s extension từ video nguồn 1-30s | Search results (preview feature) | ⚠️ Trung bình (preview, có thể thay đổi) |
| **Format output** | video/mp4 | Google Cloud Docs | ✅ Chắc chắn |
| **SynthID watermark** | Luôn có (invisible digital) | Google Cloud Docs + DeepMind | ✅ Chắc chắn |
| **4K output** | Chưa xác định cho Veo 3.1 GA chính thức | Một số nguồn mention nhưng docs chỉ ghi 720p/1080p | ❌ Chưa xác nhận |
| **Audio generation** | Native audio (dialogue, SFX, ambient) — Veo 3.1 GA | Google Cloud Blog | ✅ Chắc chắn |
| **Reference style images** | KHÔNG hỗ trợ (Veo 3.1 GA) | Google Cloud Docs — "Not supported" | ✅ Chắc chắn (chỉ subject ref, không style ref) |
| **Requests/minute quota** | 50 RPM per base model | Google Cloud Docs | ✅ Chắc chắn |

### Veo Model Variants (tính đến 07/2026)

| Model | ID | Status | Ghi chú |
|-------|----|--------|---------|
| Veo 3.1 | veo-3.1-generate-001 | GA (17/11/2025) | Full features, audio |
| Veo 3.1 Fast | veo-3.1-fast-generate-001 | GA (17/11/2025) | Nhanh hơn, cùng specs |
| Veo 3.1 Lite | veo-3.1-lite-generate-001 | Preview (02/04/2026) | Text-to-video chính, image features preview |
| Veo 3 | veo-3.0-generate-001 | GA | Thế hệ trước, vẫn dùng được |

---

## NGUỒN THAM KHẢO

1. **Google Cloud Blog** — "Ultimate prompting guide for Veo 3.1" (cloud.google.com/blog) — ✅ Primary
2. **Google DeepMind** — "How to create effective prompts with Veo 3" (deepmind.google/models/veo/prompt-guide/) — ✅ Primary
3. **Google Cloud Docs** — Veo 3.1 Generate specs (docs.cloud.google.com) — ✅ Primary/Official
4. **Google Developers Blog** — "Introducing Veo 3.1 and new creative capabilities" — ✅ Primary
5. **nofilmschool.com** — AI prompts for filmmakers — ⚠️ Secondary
6. **studiobinder.com** — Visual storytelling, 3-act structure — ⚠️ Secondary/Educational
7. **Reddit r/aivideo, filmmaker blogs** — Practical tips, community knowledge — ⚠️ Community
8. **ffmpeg documentation** — Concat, xfade, amix — ✅ Primary/Technical
9. **Various AI tool docs** — ElevenLabs, HeyGen, Rask AI — ⚠️ Vendor-specific

---

*Tài liệu này là knowledge base thực chiến. Cập nhật khi Veo specs thay đổi hoặc có technique mới.*
