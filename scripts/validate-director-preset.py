#!/usr/bin/env python3
"""Offline validator for presets/director-film.txt output contract.
Validates a sample (or real) model response: JSON parses, scene schema complete,
durations 5-8s, character sheet repeated VERBATIM in every prompt, ---HUMAN--- part present.
Usage: validate-director-preset.py [response.txt]  (default: built-in sample)
"""
import json, sys, re, os

SAMPLE = '''{
  "title": "Tro va Chiec Banh Chung Dau Tien",
  "total_duration_seconds": 30,
  "style": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes",
  "characters": [
    {"name": "Tro", "sheet": "a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist"}
  ],
  "scenes": [
    {"number": 1, "duration_seconds": 6, "shot_type": "wide",
     "action": "Tro runs into the family kitchen where his grandmother stacks green banana leaves.",
     "character_sheet": "a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist",
     "image_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, running into a cozy Vietnamese kitchen, grandmother stacking green banana leaves on a wooden table, morning light through window, wide shot",
     "video_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. wide shot, slow dolly-in. a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, runs into a cozy Vietnamese kitchen; grandmother stacks green banana leaves on a wooden table; morning light through window",
     "mood_lighting": "warm, hopeful; soft golden morning window light; pastel greens and reds",
     "sound": "cheerful flute melody, footsteps, grandmother chuckles"},
    {"number": 2, "duration_seconds": 6, "shot_type": "close-up",
     "action": "Tro watches sticky rice being scooped onto the leaves, eyes wide.",
     "character_sheet": "a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist",
     "image_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. close-up of a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, watching white sticky rice scooped onto green banana leaves, steam rising",
     "video_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. close-up, static tripod shot. a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, watches sticky rice scooped onto banana leaves; steam rises; his eyes widen",
     "mood_lighting": "curious, cozy; warm kitchen lamplight; cream and green tones",
     "sound": "soft rice pouring, gentle humming"},
    {"number": 3, "duration_seconds": 6, "shot_type": "medium",
     "action": "Tro clumsily folds his own small banh chung, leaves slipping, grandmother guides his hands.",
     "character_sheet": "a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist",
     "image_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. medium shot of a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, folding a small square banh chung with slipping banana leaves, wrinkled grandmother hands guiding his fingers",
     "video_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. medium shot, handheld slight sway. a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, folds a small banh chung; leaves slip; grandmother's hands guide his; both laugh",
     "mood_lighting": "playful, tender; warm side light; green leaf and red fabric contrast",
     "sound": "leaf rustle, giggles, light plucked strings"},
    {"number": 4, "duration_seconds": 6, "shot_type": "wide",
     "action": "Night: the pot bubbles over a fire; Tro dozes against grandmother, both wrapped in a blanket.",
     "character_sheet": "a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist",
     "image_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. wide night scene, a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, dozing against his grandmother beside a big bubbling pot over an orange fire, shared blanket, starry sky",
     "video_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. wide shot, slow crane up to starry sky. a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, dozes against grandmother; pot bubbles over fire; sparks drift upward",
     "mood_lighting": "dreamy, peaceful; orange firelight against deep blue night; soft star glow",
     "sound": "crackling fire, bubbling water, slow lullaby hum"},
    {"number": 5, "duration_seconds": 6, "shot_type": "close-up",
     "action": "Morning: Tro unwraps his banh chung — slightly crooked but perfect to him — and beams with pride.",
     "character_sheet": "a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist",
     "image_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. close-up of a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, unwrapping a slightly crooked green banh chung, face glowing with pride, morning Tet light, peach blossoms in background",
     "video_prompt": "soft watercolor children book animation, warm pastel palette, gentle rounded shapes. close-up, slow push-in then tilt up to his smile. a 6-year-old Vietnamese boy named Tro, round cheeks, big brown eyes, messy short black hair, wearing a bright red ao dai with golden trim and black cloth shoes, small blue string bracelet on left wrist, unwraps his crooked banh chung; steam curls out; he beams with pride; peach blossom petals drift by",
     "mood_lighting": "triumphant, warm; bright soft morning light; red, gold and fresh green",
     "sound": "unwrapping leaves, delighted gasp, swelling warm strings, distant firecrackers"}
  ]
}
---HUMAN---
Logline: Cậu bé Tro lần đầu tự tay gói chiếc bánh chưng cùng bà, và học được rằng món quà Tết đẹp nhất là thời gian bên nhau.
Beats: (1) Tro chạy vào bếp — bà đang xếp lá dong. (2) Tro tròn mắt nhìn xúc gạo nếp. (3) Tro vụng về gói bánh, bà cầm tay chỉ. (4) Đêm luộc bánh, hai bà cháu ngủ gật bên bếp lửa. (5) Sáng mùng Một, Tro bóc chiếc bánh méo mó mà hoàn hảo của mình.
Ghi chú sản xuất: giữ nguyên văn character sheet của Tro trong mọi prompt; style watercolor lặp lại verbatim; mỗi scene 6s x 5 = 30s.
'''

def validate(text: str) -> dict:
    report = {"checks": [], "pass": True}
    def check(name, ok, detail=""):
        report["checks"].append({"check": name, "ok": bool(ok), "detail": detail})
        if not ok: report["pass"] = False

    # split JSON part / human part
    m = re.search(r'---HUMAN---', text)
    check("has ---HUMAN--- separator", m)
    json_part = text[:m.start()] if m else text
    try:
        data = json.loads(json_part.strip())
        check("JSON parses", True)
    except Exception as e:
        check("JSON parses", False, str(e)[:120]); 
        return report
    for f in ("title", "total_duration_seconds", "style", "characters", "scenes"):
        check(f"top-level field '{f}'", f in data)
    scenes = data.get("scenes", [])
    check("scene count 4-6 for 30s", 4 <= len(scenes) <= 6, f"got {len(scenes)}")
    total = sum(s.get("duration_seconds", 0) for s in scenes)
    check("durations sum ~= total", abs(total - data.get("total_duration_seconds", 0)) <= 4, f"sum={total}")
    req = ["number","duration_seconds","shot_type","action","character_sheet","image_prompt","video_prompt","mood_lighting","sound"]
    sheets = {c["name"]: c["sheet"] for c in data.get("characters", [])}
    style = data.get("style", "")
    cam_words = re.compile(r'dolly|pan|tilt|crane|zoom|push-in|pull-back|static|handheld|tracking|aerial|POV', re.I)
    for s in scenes:
        n = s.get("number", "?")
        missing = [f for f in req if f not in s]
        check(f"scene {n} fields complete", not missing, f"missing={missing}")
        check(f"scene {n} duration 5-8s", 5 <= s.get("duration_seconds", 0) <= 8, str(s.get("duration_seconds")))
        for name, sheet in sheets.items():
            if name.lower() in s.get("action", "").lower() or sheet[:40] in s.get("character_sheet",""):
                check(f"scene {n} sheet VERBATIM in character_sheet", sheet in s.get("character_sheet",""))
                check(f"scene {n} sheet VERBATIM in image_prompt", sheet in s.get("image_prompt",""))
                check(f"scene {n} sheet VERBATIM in video_prompt", sheet in s.get("video_prompt",""))
        check(f"scene {n} style verbatim in image_prompt", style in s.get("image_prompt",""))
        check(f"scene {n} style verbatim in video_prompt", style in s.get("video_prompt",""))
        check(f"scene {n} video_prompt has camera movement", bool(cam_words.search(s.get("video_prompt",""))))
    human = text[m.end():] if m else ""
    check("human part non-empty", len(human.strip()) > 50)
    report["sceneCount"] = len(scenes)
    report["totalDuration"] = total
    return report

if __name__ == "__main__":
    src = open(sys.argv[1]).read() if len(sys.argv) > 1 else SAMPLE
    rep = validate(src)
    rep["source"] = sys.argv[1] if len(sys.argv) > 1 else "built-in sample (offline contract validation)"
    failed = [c for c in rep["checks"] if not c["ok"]]
    print(json.dumps({"pass": rep["pass"], "sceneCount": rep.get("sceneCount"), "totalDuration": rep.get("totalDuration"), "checksTotal": len(rep["checks"]), "checksFailed": failed, "source": rep["source"]}, indent=1, ensure_ascii=False))
    out = "/root/.openclaw/workspace/AUTOMATION-LABGOOGLE/out/audit4-director-preset-validation.json"
    with open(out, "w") as f: json.dump(rep, f, indent=1, ensure_ascii=False)
    sys.exit(0 if rep["pass"] else 1)
