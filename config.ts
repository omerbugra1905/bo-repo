// ============================================================
// KONFIGURASYON — DOGRULANMIS DEGERLER, DOKUNMA
// 890 islemlik backtest + seans filtresi (EV +0.237R -> +0.323R)
// Bu oturumda harness ile yeniden dogrulandi: 715 islem, EV +0.303R
// ============================================================

export const CONFIG = {
  ATR_PERIOD: 14,
  LEG_MIN_BARS: 3,
  LEG_MAX_BARS: 8,
  OVEREXT_ATR: 3.5,
  VOL_INCREASE: 1.1,
  TRIGGER_WINDOW: 3,
  SL_ATR_BUFFER: 0.15,
  TRAIL_ATR: 1.0,
  MAX_HOLD_BARS: 48,
  COOLDOWN_HOURS: 4,
  RISK_PCT: 0.005,
  VALID_MINUTES: 15,
  /** Kotu UTC saatleri — bu saatlerde tetiklenen sinyal ATILMAZ */
  SESSION_BLACKLIST_HOURS: [1, 2, 3, 5, 7, 10],
} as const;

/**
 * DIKKAT: bugraapi Nasdaq'i "NDX" olarak servis ediyor.
 * "NAS100USD" -> HTTP 404 (duman testinde yakalandi).
 * Tum backtest/dogrulama da NDX ile yapildi — degistirme.
 */
export const SYMBOLS = ["XAUUSD", "NDX", "XAGUSD"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const API_BASE = "https://bugraapi.onrender.com";
export const INTERVAL = "1h";
export const INTERVAL_MS = 3_600_000;
export const CANDLE_COUNT = 50;

/** Fetch ayarlari */
export const FETCH_TIMEOUT_MS = 60_000;
export const FETCH_RETRIES = 3;

/** Fiyat ondalik basamak sayisi (mesaj formati icin) */
export function digitsFor(symbol: string): number {
  return symbol.startsWith("XAG") ? 3 : 2;
}

/**
 * Detektorun calisabilmesi icin gereken minimum mum sayisi.
 * Python backtest ile BIREBIR ayni sinir:
 *   en erken setup bari sIdx = ATR_PERIOD + 5 (=19)
 *   -> en erken trigger i = 20  -> en az 21 mum gerekir.
 * (Canlida 50 mum cekiliyor, bu sinir pratikte hic devreye girmez;
 *  ama backtest ile birebir dogrulama yapilabilsin diye dogru tutuluyor.)
 */
export const MIN_CANDLES = CONFIG.ATR_PERIOD + 7; // 21
