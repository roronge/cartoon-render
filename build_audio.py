#!/usr/bin/env python3
"""Audio for the Pisa pilot: original march (synthesized with the cartoon-3d-short
template DSP kit: dsp.py + instruments.py), Indonesian VO from the fixed Edge TTS
pipeline, and synthesized SFX (whoosh on cuts, soil squish, wood creak, hammer
clangs synced to story.ts HAMMER_T, finale arpeggio). Outputs a stereo premaster
WAV; loudnorm to -14 LUFS happens at mux time (ffmpeg, two-pass)."""
import json
import sys
from pathlib import Path

import numpy as np

ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT / "work" / "audiokit"))
from dsp import SR, ns, rng, bp, lp, colored, modal, write_wav, read_wav  # noqa: E402
import instruments as ins  # noqa: E402

FPS = 30
TOTAL_FRAMES = 935
DUR = TOTAL_FRAMES / FPS + 0.25
N = ns(DUR)
timings = json.loads((ROOT / "src/videos/pisa/timings.json").read_text())
shot_frames = [round((s["durationSec"] + 0.22) * FPS) for s in timings["sentences"]]
A = [0]
for n in shot_frames[:-1]:
    A.append(A[-1] + n)
SHOT_SEC = [a / FPS for a in A]
HAMMER_T = [SHOT_SEC[4] + s for s in (0.7, 1.45, 2.2)]
R = rng(1173)

music = np.zeros((N, 2))
sfx = np.zeros((N, 2))
vo = np.zeros(N)


def place(buf, sig, t, gain=1.0, pan=0.0):
    i = ns(t)
    if i >= N:
        return
    sig = np.asarray(sig, float) * gain
    if sig.ndim == 1:
        gl = np.cos((pan + 1) * np.pi / 4)
        gr = np.sin((pan + 1) * np.pi / 4)
        seg = np.stack([sig * gl, sig * gr], axis=1)
    else:
        seg = sig
    j = min(N, i + len(seg))
    buf[i:j] += seg[: j - i]


# ---------------- original march, C major, 126 BPM ----------------
BPM = 126.0
BEAT = 60.0 / BPM
BAR = 4 * BEAT
CHORDS = [  # (root midi, [chord midis]) per bar, 16 bars
    (48, [60, 64, 67]), (48, [60, 64, 67]), (53, [65, 69, 72]), (48, [60, 64, 67]),
    (48, [60, 64, 67]), (48, [60, 64, 67]), (53, [65, 69, 72]), (55, [67, 71, 74]),
    (48, [60, 64, 67]), (48, [60, 64, 67]), (53, [65, 69, 72]), (48, [60, 64, 67]),
    (53, [65, 69, 72]), (55, [67, 71, 74]), (48, [60, 64, 67]), (48, [60, 64, 67]),
]
# original melody: (bar, beat, midi, beats) — a bouncy, singable line, NOT the bridge theme
MEL = [
    (0, 0, 72, 1), (0, 1, 76, 1), (0, 2, 79, 1.5), (0, 3.5, 76, 0.5),
    (1, 0, 77, 1), (1, 1, 76, 1), (1, 2, 74, 1), (1, 3, 72, 1),
    (2, 0, 74, 1), (2, 1, 77, 1), (2, 2, 81, 1.5), (2, 3.5, 77, 0.5),
    (3, 0, 76, 2), (3, 2, 72, 2),
    (4, 0, 72, 1), (4, 1, 76, 1), (4, 2, 79, 1.5), (4, 3.5, 76, 0.5),
    (5, 0, 77, 1), (5, 1, 76, 1), (5, 2, 74, 1), (5, 3, 72, 1),
    (6, 0, 74, 1), (6, 1, 77, 1), (6, 2, 81, 1), (6, 3, 79, 1),
    (7, 0, 74, 3), (7, 3, 71, 1),
    (8, 0, 72, 1), (8, 1, 76, 1), (8, 2, 79, 1.5), (8, 3.5, 76, 0.5),
    (9, 0, 77, 1), (9, 1, 76, 1), (9, 2, 74, 1), (9, 3, 72, 1),
    (10, 0, 74, 1), (10, 1, 77, 1), (10, 2, 81, 1.5), (10, 3.5, 77, 0.5),
    (11, 0, 76, 2), (11, 2, 72, 2),
    (12, 0, 77, 1), (12, 1, 81, 1), (12, 2, 84, 1.5), (12, 3.5, 81, 0.5),
    (13, 0, 79, 1), (13, 1, 74, 1), (13, 2, 71, 1), (13, 3, 74, 1),
    (14, 0, 72, 3),
]
for b, (root, chord) in enumerate(CHORDS):
    t0 = b * BAR
    if t0 > DUR - 0.5:
        break
    # oompah: tuba root on 1, fifth on 3; brass "pah" chords on 2 and 4
    place(music, ins.brass(ins.m2f(root), BEAT * 0.95, 0.55, R, kind="tuba"), t0, 0.85, -0.15)
    place(music, ins.brass(ins.m2f(root + 7), BEAT * 0.95, 0.5, R, kind="tuba"), t0 + 2 * BEAT, 0.8, -0.15)
    for bt in (1, 3):
        for mnote in chord:
            place(music, ins.brass(ins.m2f(mnote - 12), BEAT * 0.5, 0.30, R, kind="horn"), t0 + bt * BEAT, 0.5, 0.2)
    # snare on 2 and 4, triangle sparkle on 1
    for bt in (1, 3):
        place(music, ins.snare(0.5, R), t0 + bt * BEAT, 0.5, 0.1)
    place(music, ins.triangle(0.35, R), t0, 0.4, 0.35)
for (b, bt, mnote, ln) in MEL:
    t = b * BAR + bt * BEAT
    if t > DUR - 0.4:
        continue
    place(music, ins.glock(ins.m2f(mnote + 12), 0.5, R), t, 0.55, 0.15)
    place(music, ins.fife(ins.m2f(mnote), ln * BEAT * 0.92, 0.34, R), t, 0.5, -0.1)
# snare rolls into shot 5 (hammering) and the finale
for t0 in (SHOT_SEC[4] - 0.45, SHOT_SEC[5] - 0.45):
    place(music, ins.snare_roll(t0, t0 + 0.45, 0.15, 0.55, R), t0, 0.6, 0.1)
# final chord hit
place(music, ins.cymbal(0.4, R), 15 * BAR, 0.35, 0)
for mnote in (48, 55, 60, 64, 67):
    place(music, ins.brass(ins.m2f(mnote), BAR * 0.9, 0.4, R, kind="tuba" if mnote < 60 else "horn"), 15 * BAR, 0.5, 0)

# duck the music under the narration
gain = np.full(N, 0.62)
for i, s in enumerate(timings["sentences"]):
    a = ns(SHOT_SEC[i] + 0.04)
    b = ns(SHOT_SEC[i] + s["durationSec"] + 0.18)
    gain[a:b] = 0.20
# smooth the ducking envelope (~70 ms)
k = np.ones(ns(0.07)) / ns(0.07)
gain = np.convolve(gain, k, mode="same")
music *= gain[:, None]

# ---------------- SFX ----------------
def whoosh(t, g=0.22):
    n = ns(0.38)
    x = colored(n, R, slope=0.5)
    sweep = np.linspace(280, 2600, n)
    # cheap time-varying bandpass: two static bands crossfaded
    lo = bp(x, 200, 700)
    hi = bp(x, 900, 3400)
    w = np.linspace(0, 1, n)[:, None] if lo.ndim > 1 else np.linspace(0, 1, n)
    y = lo * (1 - w) + hi * w
    env = np.sin(np.linspace(0, np.pi, n)) ** 1.5
    place(sfx, y * env, t, g, 0)

for t in SHOT_SEC[1:]:
    whoosh(t)
# flash shimmer right after the hook
for j, mnote in enumerate((84, 88, 91, 96)):
    place(sfx, ins.glock(ins.m2f(mnote), 0.3, R), SHOT_SEC[1] + j * 0.07, 0.3, 0.2)
# soil squish in shot 3 (soft ground giving way)
for t in (SHOT_SEC[2] + 1.1, SHOT_SEC[2] + 2.9):
    n = ns(0.5)
    ph = np.cumsum(np.linspace(95, 48, n)) / SR * 2 * np.pi
    x = np.sin(ph) * np.sin(np.linspace(0, np.pi, n)) ** 1.2
    place(sfx, x, t, 0.30, 0)
# wood/tower creaks in shot 4 as the lean grows
for t, f0 in ((SHOT_SEC[3] + 1.6, 210), (SHOT_SEC[3] + 3.6, 170)):
    n = ns(0.8)
    fr = np.linspace(f0, f0 * 0.55, n) * (1 + 0.03 * np.sin(np.linspace(0, 40, n)))
    ph = np.cumsum(fr) / SR * 2 * np.pi
    x = (np.sin(ph) + 0.4 * np.sin(2 * ph)) * np.sin(np.linspace(0, np.pi, n)) ** 1.5
    place(sfx, lp(x, 900), t, 0.16, -0.2)
# hammer clangs exactly on the visual strikes (story.ts HAMMER_T)
for t in HAMMER_T:
    modes = [(612, 0.9, 0.30), (1477, 0.55, 0.16), (2513, 0.35, 0.09), (3920, 0.2, 0.05), (233, 0.7, 0.35)]
    hit = modal(0.55, modes, R)
    tick = colored(ns(0.03), R, slope=1.0) * np.linspace(1, 0, ns(0.03))
    place(sfx, hit, t, 0.5, 0.25)
    place(sfx, tick, t, 0.25, 0.25)
# finale: bright arpeggio as the postcard wide opens
for j, mnote in enumerate((72, 76, 79, 84)):
    place(sfx, ins.glock(ins.m2f(mnote), 0.4, R), SHOT_SEC[5] + 0.15 + j * 0.09, 0.4, 0.1)

# ---------------- VO ----------------
for i in range(6):
    x, sr = read_wav(str(ROOT / f"public/audio/pisa/scene-{i + 1}.wav"))
    assert sr == SR, sr
    if x.ndim > 1:
        x = x[:, 0]
    a = ns(SHOT_SEC[i] + 0.05)
    b = min(N, a + len(x))
    vo[a:b] += x[: b - a]

mix = music + sfx + np.stack([vo, vo], axis=1) * 0.95
mix = np.tanh(mix * 0.9)
out = ROOT / "out/menara-pisa/premaster.wav"
from scipy.io import wavfile  # the kit's write_wav overflows on long 24-bit stereo
wavfile.write(str(out), SR, (np.clip(mix, -1, 1) * 32767).astype(np.int16))
print("premaster:", out, f"{DUR:.2f}s", "shots@", [round(s, 2) for s in SHOT_SEC], "hammer@", [round(s, 2) for s in HAMMER_T])
