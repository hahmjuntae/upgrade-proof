# 지정한 장면 번호만 Kokoro 음성 재생성(kokoro-venv 전용)
import json, sys, numpy as np, soundfile as sf
from kokoro import KPipeline
scenes, outdir, ids = sys.argv[1], sys.argv[2], [int(x) for x in sys.argv[3].split(",")]
pipe = KPipeline(lang_code="a", repo_id="hexgrad/Kokoro-82M")
data = json.load(open(scenes))
for i in ids:
    s = data[i - 1]
    audio = np.concatenate([a for _, _, a in pipe(s.get("say", s["text"]), voice="af_heart", speed=1.0)])
    sf.write(f"{outdir}/{i:02d}.wav", audio, 24000)
    print(i, f"{len(audio)/24000:.1f}s", flush=True)
