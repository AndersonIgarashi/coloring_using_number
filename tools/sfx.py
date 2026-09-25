"""Synthesised sound effects: select (bloop), fill (marimba plink),
color-complete (bell arpeggio) and win (short fanfare)."""
import os
import wave
import numpy as np

SR = 44100
rng = np.random.default_rng(3)


def t_axis(dur):
    return np.arange(int(SR * dur)) / SR


def env(t, attack, decay):
    a = np.clip(t / attack, 0, 1)
    return a * np.exp(-np.maximum(t - attack, 0) / decay)


def tail(sig, frac=0.3):
    n = max(1, int(len(sig) * frac))
    sig[-n:] *= np.linspace(1, 0, n) ** 2
    return sig


def note(freq):
    return 440.0 * 2 ** ((freq - 69) / 12)


def place(buf, sig, at):
    i = int(at * SR)
    end = min(len(buf), i + len(sig))
    buf[i:end] += sig[:end - i]


def bell(freq, dur, decay=0.35, index=2.2, ratio=3.5, amp=1.0):
    t = t_axis(dur)
    mod = index * np.exp(-t / (decay * 0.35)) * np.sin(2 * np.pi * freq * ratio * t)
    return tail(amp * env(t, 0.002, decay) * np.sin(2 * np.pi * freq * t + mod))


def marimba(freq, dur=0.22, decay=0.075, amp=1.0):
    t = t_axis(dur)
    s = np.sin(2 * np.pi * freq * t) * env(t, 0.0015, decay)
    s += 0.35 * np.sin(2 * np.pi * freq * 3.93 * t) * env(t, 0.001, decay * 0.25)
    s += 0.12 * np.sin(2 * np.pi * freq * 9.4 * t) * env(t, 0.0008, decay * 0.1)
    click = rng.standard_normal(len(t)) * env(t, 0.0003, 0.0025) * 0.25
    return tail(amp * (s + click))


def pluck(freq, dur, amp=1.0):
    n = int(SR * dur)
    period = int(SR / freq)
    buf = rng.uniform(-1, 1, period)
    out = np.zeros(n)
    for i in range(n):
        out[i] = buf[i % period]
        buf[i % period] = 0.996 * 0.5 * (out[i] + buf[(i + 1) % period])
    t = t_axis(dur)
    return tail(amp * out * env(t, 0.002, dur * 0.45))


def sweep_sine(f0, f1, dur, curve=0.35):
    t = t_axis(dur)
    k = np.clip(t / (dur * curve), 0, 1)
    f = f0 + (f1 - f0) * (1 - (1 - k) ** 2)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.zeros_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def finish(sig, peak_db=-1.0, fade_ms=6):
    n = int(SR * fade_ms / 1000)
    sig[:4] *= np.linspace(0, 1, 4)
    sig[-n:] *= np.linspace(1, 0, n)
    peak = np.max(np.abs(sig)) or 1
    return sig / peak * 10 ** (peak_db / 20)


def make_select():
    dur = 0.2
    t = t_axis(dur)
    body = sweep_sine(430, 780, dur, 0.4) * env(t, 0.003, 0.055)
    body += 0.3 * sweep_sine(860, 1560, dur, 0.4) * env(t, 0.002, 0.03)
    click = lowpass(rng.standard_normal(len(t)), 3500) * env(t, 0.0005, 0.004) * 0.6
    return finish(body + click, -2.0)


def make_fill():
    return finish(marimba(note(84), 0.24, 0.08) + 0.25 * bell(note(96), 0.24, 0.05, 1.2, 2.0), -2.0)


def make_color_complete():
    out = np.zeros(int(SR * 0.95))
    for i, m in enumerate([76, 80, 83, 88]):
        place(out, bell(note(m), 0.7, 0.28, 1.8, 3.5, 1.0 - i * 0.08), i * 0.055)
        place(out, 0.35 * marimba(note(m), 0.3, 0.06), i * 0.055)
    for k in range(9):
        place(out, 0.12 * bell(note(96 + rng.integers(0, 12)), 0.25, 0.08, 0.6, 2.0), 0.18 + k * 0.05)
    return finish(out, -1.5)


def make_win():
    dur = 2.4
    out = np.zeros(int(SR * dur))
    run = [67, 72, 76, 79, 84]
    for i, m in enumerate(run):
        place(out, 0.9 * pluck(note(m), 0.5), i * 0.075)
        place(out, 0.35 * bell(note(m + 12), 0.4, 0.16, 1.4, 3.0), i * 0.075)
    chord_at = len(run) * 0.075 + 0.05
    for m, a in [(72, 0.6), (76, 0.55), (79, 0.55), (84, 0.5), (88, 0.35)]:
        place(out, a * pluck(note(m), 1.8), chord_at)
        place(out, a * 0.55 * bell(note(m), 1.8, 0.7, 1.3, 2.0), chord_at + 0.01)
    t = t_axis(1.9)
    bass = np.sin(2 * np.pi * note(48) * t) * env(t, 0.01, 0.6) * 0.5
    bass += 0.3 * np.sin(2 * np.pi * note(60) * t) * env(t, 0.01, 0.5)
    place(out, bass, chord_at)
    for k in range(16):
        place(out, 0.1 * bell(note(91 + (k * 5) % 14), 0.3, 0.09, 0.7, 2.0), chord_at + 0.05 + k * 0.045)
    t = t_axis(0.6)
    whoosh = lowpass(rng.standard_normal(len(t)), 1800) * np.sin(np.pi * np.clip(t / 0.6, 0, 1)) ** 2 * 0.1
    place(out, whoosh, 0.0)
    return finish(out, -1.0, fade_ms=120)


def write(path, sig):
    data = (np.clip(sig, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data.tobytes())


SOUNDS = [('select', make_select), ('fill', make_fill), ('color-complete', make_color_complete), ('win', make_win)]


def write_all(out_dir):
    for name, fn in SOUNDS:
        sig = fn()
        write(os.path.join(out_dir, name + '.wav'), sig)
        print('sound', name, f'{len(sig) / SR:.2f}s')
