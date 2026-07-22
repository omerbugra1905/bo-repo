// ============================================================
// GOSTERGELER
// ============================================================
import type { Candle } from "./types.ts";

/**
 * ATR — True Range'in BASIT ORTALAMASI (SMA), Wilder DEGIL.
 * Backtest ile birebir ayni olmali: pandas .rolling(period).mean()
 *
 * idx dahil, geriye dogru `period` bar. bars[idx-period] erisimi
 * gerektigi icin cagiran taraf idx >= period saglamali.
 */
export function atrAt(bars: Candle[], idx: number, period: number): number {
  let sum = 0;
  for (let k = idx - period + 1; k <= idx; k++) {
    const prev = bars[k - 1];
    const cur = bars[k];
    const tr = Math.max(
      cur.h - cur.l,
      Math.abs(cur.h - prev.c),
      Math.abs(cur.l - prev.c),
    );
    sum += tr;
  }
  return sum / period;
}
