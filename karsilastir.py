# -*- coding: utf-8 -*-
"""
TS detektor <-> Python backtest KARSILASTIRMA
=============================================
dogrula.ts'in urettigi ts_sinyaller.json ile Python harness'in
uretttigi girisleri kiyaslar. AYNI cache verisi kullanilir.

BEKLENTI:
  Python'un HER girisi, TS sinyal kumesinin ICINDE olmali.
  (TS her barda bagimsiz calisir -> daha cok sinyal uretir, bu normal.
   Python giris sonrasi i=j+1 ile ileri atlar, ust uste setuplari atlar.)

EKSIK VARSA = detektorde BUG var, deploy etme.
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from bt import veri, motor
from stratejiler.exhaustion_v22 import ExhaustionV22

HARITA = {"XAUUSD": "XAUUSD", "XAGUSD": "XAGUSD", "NDX": "NDX"}

with open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "ts_sinyaller.json"),
          encoding="utf-8") as f:
    ts = json.load(f)

st = ExhaustionV22()
print("\n=== TS vs PYTHON KARSILASTIRMA ===\n")

toplam_eksik = 0
for sem, ts_key in HARITA.items():
    if ts_key not in ts:
        print(f"{sem}: TS ciktisinda yok, atlandi")
        continue

    df = veri.getir(sem, "1h")
    islemler = motor.calistir(st, {sem: df})
    py_zamanlar = {str(t["giris_zamani"])[:19].replace(" ", "T") for t in islemler}
    ts_zamanlar = set(ts[ts_key])

    eksik = py_zamanlar - ts_zamanlar          # Python'da var, TS'te YOK -> BUG
    fazla = ts_zamanlar - py_zamanlar          # TS'te var, Python'da yok -> beklenen

    print(f"{sem}:")
    print(f"  Python girisi : {len(py_zamanlar)}")
    print(f"  TS sinyali    : {len(ts_zamanlar)}")
    print(f"  Ortak         : {len(py_zamanlar & ts_zamanlar)}")
    print(f"  TS fazlasi    : {len(fazla)}  (normal — backtest ileri atliyor)")
    print(f"  TS'te EKSIK   : {len(eksik)}  {'✓ SORUN YOK' if not eksik else '✗ BUG!'}")
    if eksik:
        toplam_eksik += len(eksik)
        for z in sorted(eksik)[:5]:
            print(f"      eksik: {z}")
    print()

print("=" * 60)
if toplam_eksik == 0:
    print("✓ DOGRULANDI: Python'un tum girisleri TS detektorunde de var.")
    print("  Detektor mantigi backtest ile uyumlu — deploy edilebilir.")
else:
    print(f"✗ {toplam_eksik} giris TS'te YOK — detektorde bug var, DEPLOY ETME.")
