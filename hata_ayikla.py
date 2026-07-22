# -*- coding: utf-8 -*-
"""Eksik 2 NDX sinyalini adim adim incele: backtest ne buldu, canli mantik neden bulamadi?"""
import os
import sys
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bt import veri, motor
from stratejiler.exhaustion_v22 import ExhaustionV22

HEDEF = ["2025-09-16 14:00:00", "2025-09-16 16:00:00"]
P = ExhaustionV22().parametreler

df = motor._atr_ekle(veri.getir("NDX", "1h").copy(), P["ATR_PERIOD"])
d = motor.Veri(df)
zamanlar = [str(x) for x in df["datetime"]]

for hedef in HEDEF:
    j = zamanlar.index(hedef)
    print(f"\n{'='*70}\nTRIGGER bar: {hedef}  -> index {j}")
    print(f"  o={d.o[j]:.2f} c={d.c[j]:.2f}  ({'BULL' if d.c[j]>d.o[j] else 'BEAR' if d.c[j]<d.o[j] else 'DOJI'})")

    # --- BACKTEST mantigi: hangi setup barindan girdi? ---
    print("  --- backtest: setup adaylari (i = j-1, j-2, j-3) ---")
    for since in (1, 2, 3):
        i = j - since
        if i < P["ATR_PERIOD"] + 5:
            print(f"    i={i} (since={since}): ISINMA SINIRI ALTI (< {P['ATR_PERIOD']+5})")
            continue
        atr = d.atr[i]
        if np.isnan(atr):
            print(f"    i={i}: ATR NaN")
            continue
        bulundu = None
        for lb in range(P["LEG_MIN_BARS"], P["LEG_MAX_BARS"] + 1):
            s = i - lb
            if s < 4:
                continue
            for tip, bacak, ekstrem in (("TEPE", d.h[i] - d.l[s], d.h[i]),
                                        ("DIP", d.h[s] - d.l[i], d.l[i])):
                if bacak < P["OVEREXT_ATR"] * atr:
                    continue
                yari = (lb + 1) // 2
                v1 = d.v[s:s + yari].mean()
                v2 = d.v[s + yari:i + 1].mean()
                if v1 <= 0 or v2 <= v1 * P["VOL_INCREASE"]:
                    continue
                bulundu = (lb, tip, bacak / atr, v2 / v1, ekstrem)
                break
            if bulundu:
                break
        if bulundu:
            lb, tip, latr, vr, ek = bulundu
            # tetikleyici yonu uyuyor mu?
            uyum = (tip == "TEPE" and d.c[j] < d.o[j]) or (tip == "DIP" and d.c[j] > d.o[j])
            print(f"    i={i} (since={since}): SETUP {tip} lb={lb} {latr:.2f}xATR vol={vr:.2f} "
                  f"atr={atr:.3f} -> trigger yonu {'UYUYOR' if uyum else 'UYMUYOR'}")
        else:
            print(f"    i={i} (since={since}): setup yok (atr={atr:.3f})")

    # --- backtest gercekte hangi i'den girdi? ---
    # motor.calistir'i taklit et: j'ye ulasan ilk setup
    print("  --- backtest ilk-reversal kurali ---")
    for since in (1, 2, 3):
        i = j - since
        if i < P["ATR_PERIOD"] + 5:
            continue
        # i'den sonraki ilk ters mum j mi?
        ilk = None
        for k in range(i + 1, min(i + 1 + P["TRIGGER_WINDOW"], d.n)):
            if d.c[k] < d.o[k]:
                ilk = ("BEAR", k); break
            if d.c[k] > d.o[k]:
                ilk = ("BULL", k); break
        print(f"    i={i}: i sonrasi ilk ters mum -> {ilk}  {'== TRIGGER' if ilk and ilk[1]==j else ''}")
