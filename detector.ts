// ============================================================
// DETEKTOR — exhaustion_detector_v2.2.js'in birebir portu
// ------------------------------------------------------------
// SIRA ONEMLI (canli mantik):
//   1. son kapanan mum trigger mi (bogaci/ayici, doji degil)
//   2. geriye 1..TRIGGER_WINDOW mum: setup var mi (uzama + hacim)
//   3. SEANS FILTRESI  <- cooldown'dan ONCE (elenen sinyal cooldown yemesin)
//   4. cooldown        <- main.ts'te, KV ile
// ============================================================
import { CONFIG, INTERVAL_MS, MIN_CANDLES } from "./config.ts";
import { atrAt } from "./indicators.ts";
import type { Candle, DetectResult, Setup } from "./types.ts";

export function detect(candles: Candle[], symbol: string): DetectResult {
  if (candles.length < MIN_CANDLES) {
    return { skip: true, reason: `yetersiz veri (${candles.length}/${MIN_CANDLES})` };
  }

  // --- 1) Son kapanan mum trigger mi? ---
  const i = candles.length - 1;
  const trigger = candles[i];
  const isBearishTrigger = trigger.c < trigger.o;
  const isBullishTrigger = trigger.c > trigger.o;
  if (!isBearishTrigger && !isBullishTrigger) {
    return { skip: true, reason: "trigger doji" };
  }

  // --- 2) Setup ara (geriye dogru trigger penceresi) ---
  let sig: Setup | null = null;

  outer:
  for (let sinceSetup = 1; sinceSetup <= CONFIG.TRIGGER_WINDOW; sinceSetup++) {
    const sIdx = i - sinceSetup;
    // Python backtest ile BIREBIR ayni isinma siniri:
    //   dongu basi i >= ATR_PERIOD + 5, ve her lb icin i - lb >= 4
    if (sIdx < CONFIG.ATR_PERIOD + 5) continue;

    const sBar = candles[sIdx];
    const sAtr = atrAt(candles, sIdx, CONFIG.ATR_PERIOD);
    if (!(sAtr > 0)) continue;

    for (let lb = CONFIG.LEG_MIN_BARS; lb <= CONFIG.LEG_MAX_BARS; lb++) {
      if (sIdx - lb < 4) continue;
      const start = candles[sIdx - lb];
      if (!start) continue;

      // TEPE once, DIP sonra — backtest ile ayni sira
      const candidates = [
        { type: "TEPE" as const, leg: sBar.h - start.l, extreme: sBar.h, needsBearish: true },
        { type: "DIP" as const, leg: start.h - sBar.l, extreme: sBar.l, needsBearish: false },
      ];

      for (const cnd of candidates) {
        if (cnd.leg < CONFIG.OVEREXT_ATR * sAtr) continue;
        // trigger yonu setup tipiyle uyusmali
        if (cnd.needsBearish && !isBearishTrigger) continue;
        if (!cnd.needsBearish && !isBullishTrigger) continue;

        // hacim: bacagin 2. yarisi 1. yarinin VOL_INCREASE kati olmali
        const legBars = candles.slice(sIdx - lb, sIdx + 1); // lb+1 mum
        const half = Math.floor(legBars.length / 2);
        const firstHalf = legBars.slice(0, half);
        const secondHalf = legBars.slice(half);
        const v1 = firstHalf.reduce((s, b) => s + b.v, 0) / (firstHalf.length || 1);
        const v2 = secondHalf.reduce((s, b) => s + b.v, 0) / (secondHalf.length || 1);
        if (v1 <= 0 || v2 <= v1 * CONFIG.VOL_INCREASE) continue;

        sig = {
          type: cnd.type,
          isShort: cnd.needsBearish,
          atr: sAtr,
          extreme: cnd.extreme,
          lb,
          sinceSetup,
          volRatio: v2 / v1,
          legAtrMult: cnd.leg / sAtr,
        };
        break outer;
      }
    }
  }

  if (!sig) return { skip: true, reason: "setup yok" };

  // --- 3) SEANS FILTRESI (cooldown'dan ONCE) ---
  const triggerHourUtc = new Date(trigger.t).getUTCHours();
  if ((CONFIG.SESSION_BLACKLIST_HOURS as readonly number[]).includes(triggerHourUtc)) {
    return {
      skip: true,
      reason: `seans filtresi (${String(triggerHourUtc).padStart(2, "0")}:00 UTC)`,
    };
  }

  // --- 4) Fiyat / SL / risk ---
  const entry = trigger.c;
  const sl = sig.isShort
    ? sig.extreme + sig.atr * CONFIG.SL_ATR_BUFFER
    : sig.extreme - sig.atr * CONFIG.SL_ATR_BUFFER;
  const riskPt = Math.abs(entry - sl);
  if (!(riskPt > 0)) return { skip: true, reason: "risk 0" };

  return {
    symbol,
    direction: sig.isShort ? "SHORT" : "LONG",
    setupType: sig.type,
    entry,
    sl,
    riskPt,
    atr: sig.atr,
    extreme: sig.extreme,
    volRatio: sig.volRatio,
    legAtrMult: sig.legAtrMult,
    lb: sig.lb,
    triggerTime: trigger.t,
    expiresAt: trigger.t + INTERVAL_MS + CONFIG.VALID_MINUTES * 60_000,
  };
}
