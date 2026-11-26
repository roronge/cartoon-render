#!/usr/bin/env python3
"""TTS per kalimat untuk pilot Pisa — menyalin jalur Edge TTS yang sudah
diperbaiki dari proyek cooking-tutorials (websockets, parser header-length,
format 24kHz/96k, id-ID-GadisNeural). Output: MP3 per kalimat + fade anti-klik
WAV 48kHz, dan timings.json berisi durasi terukur tiap kalimat."""
import asyncio, json, os, ssl, subprocess, sys, uuid
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(ROOT, "public", "audio", "pisa")
VOICE = "id-ID-GadisNeural"
OUTPUT_FORMAT = "audio-24khz-96kbitrate-mono-mp3"

SENTENCES = [
    "Menara ini sudah miring delapan ratus tahun — tapi tak pernah roboh.",
    "Tahun sebelas tujuh tiga, Pisa membangun menara lonceng lima puluh enam meter.",
    "Fondasinya cuma tiga meter, di atas tanah rawa lunak seperti puding.",
    "Baru lantai tiga, menara sudah miring ke selatan — tanahnya ambles perlahan.",
    "Pekerja menambal sisi selatan lebih tinggi — hasilnya melengkung seperti pisang!",
    "Perang menghentikannya seratus tahun — tanah memadat, dan miring itu membuat Pisa mendunia.",
]

async def synth_one(text, out_path):
    import websockets
    from edge_tts.constants import BASE_HEADERS, SEC_MS_GEC_VERSION, WSS_URL
    from edge_tts.drm import DRM

    ca = os.environ.get("SSL_CERT_FILE")
    ctx = ssl.create_default_context(cafile=ca) if ca and os.path.exists(ca) else None
    gec = DRM.generate_sec_ms_gec()
    url = f"{WSS_URL}&ConnectionId={uuid.uuid4().hex}&Sec-MS-GEC={gec}&Sec-MS-GEC-Version={SEC_MS_GEC_VERSION}"
    headers = {
        "Pragma": "no-cache", "Cache-Control": "no-cache",
        "Origin": "chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold",
        "User-Agent": BASE_HEADERS["User-Agent"], "Accept-Language": "en-US,en;q=0.9",
    }
    date = datetime.now(timezone.utc).strftime("%a %b %d %Y %H:%M:%S GMT+0000 (Coordinated Universal Time)")
    cfg_json = json.dumps({"context": {"synthesis": {"audio": {
        "metadataoptions": {"sentenceBoundaryEnabled": "false", "wordBoundaryEnabled": "false"},
        "outputFormat": OUTPUT_FORMAT}}}})
    cfg = ("X-Timestamp:" + date + "\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n" + cfg_json)
    ssml = (f"X-RequestId:{uuid.uuid4().hex}\r\nContent-Type:application/ssml+xml\r\nX-Timestamp:{date}Z\r\nPath:ssml\r\n\r\n"
            f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='id-ID'>"
            f"<voice name='{VOICE}'><prosody pitch='+0Hz' rate='+30%'>{text}</prosody></voice></speak>")
    async with websockets.connect(url, additional_headers=headers, ssl=ctx,
                                  proxy=os.environ.get("https_proxy"), max_size=None) as ws:
        await ws.send(cfg)
        await ws.send(ssml)
        audio = b""
        async for msg in ws:
            if isinstance(msg, bytes):
                if len(msg) < 2:
                    continue
                header_length = int.from_bytes(msg[:2], "big")
                hdrs = {}
                for line in msg[:header_length].split(b"\r\n"):
                    if b":" in line:
                        k, v = line.split(b":", 1)
                        hdrs[k] = v
                if hdrs.get(b"Path") == b"audio":
                    audio += msg[header_length + 2:]
            elif "Path:turn.end" in msg:
                break
    if len(audio) < 1000:
        raise RuntimeError(f"Audio terlalu kecil ({len(audio)} byte): {text[:40]}")
    with open(out_path, "wb") as f:
        f.write(audio)

def probe_dur(path):
    out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "json", path], capture_output=True, text=True, check=True)
    return float(json.loads(out.stdout)["format"]["duration"])

async def main():
    os.makedirs(OUT, exist_ok=True)
    timings = []
    for i, text in enumerate(SENTENCES, 1):
        mp3 = os.path.join(OUT, f"scene-{i}.mp3")
        wav = os.path.join(OUT, f"scene-{i}.wav")
        await synth_one(text, mp3)
        dur = probe_dur(mp3)
        # WAV 48kHz dengan fade in/out 8 ms anti-klik (pola pipeline cooking v3)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp3,
                        "-af", "aresample=48000,afade=t=in:st=0:d=0.008,areverse,afade=t=in:st=0:d=0.008,areverse",
                        "-ac", "1", wav], check=True)
        timings.append({"scene": i, "text": text, "mp3": f"scene-{i}.mp3", "wav": f"scene-{i}.wav",
                        "durationSec": round(dur, 3)})
        print(i, round(dur, 2), "s —", text[:50])
    total = sum(t["durationSec"] for t in timings)
    print("TOTAL VO:", round(total, 2), "s")
    with open(os.path.join(ROOT, "src", "videos", "pisa", "timings.json"), "w") as f:
        json.dump({"sentences": timings, "totalVoSec": round(total, 3)}, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    asyncio.run(main())
