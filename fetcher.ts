// ============================================================
// VERI CEKME — bugraapi + retry + forming bar temizligi
// ============================================================
import {
  API_BASE,
  CANDLE_COUNT,
  FETCH_RETRIES,
  FETCH_TIMEOUT_MS,
  INTERVAL,
  INTERVAL_MS,
} from "./config.ts";
import type { Candle } from "./types.ts";

/**
 * "2026-01-01T00:00:00" gibi timezone'suz ISO stringi JS YEREL saat sayar.
 * Sunucu UTC olsa bile bu kirilgan — acikca UTC'ye sabitliyoruz.
 */
function parseUtc(dt: string): number {
  const s = String(dt).trim().replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(s);
  return new Date(hasZone ? s : s + "Z").getTime();
}

interface RawCandle {
  datetime: string;
  open: string | number;
  high: string | number;
  low: string | number;
  close: string | number;
  volume?: string | number;
}

/** Tek sembol icin mumlari ceker, normalize eder, forming bar'i atar. */
export async function fetchCandles(symbol: string): Promise<Candle[]> {
  const url = `${API_BASE}/candles/${symbol}/${INTERVAL}?n=${CANDLE_COUNT}`;
  let lastErr: unknown;

  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      // bugraapi "values" doner; eski n8n sekli "candles" olabilir
      const raw: RawCandle[] = data.values ?? data.candles ?? [];

      const candles: Candle[] = raw
        .filter((c) => c && c.open != null && c.close != null)
        .map((c) => ({
          t: parseUtc(c.datetime),
          o: parseFloat(String(c.open)),
          h: parseFloat(String(c.high)),
          l: parseFloat(String(c.low)),
          c: parseFloat(String(c.close)),
          v: parseFloat(String(c.volume ?? 0)) || 0,
        }))
        .filter((c) => Number.isFinite(c.t) && Number.isFinite(c.c))
        .sort((a, b) => a.t - b.t);

      // --- FORMING BAR: kapanmamis son mumu at ---
      while (
        candles.length > 0 &&
        candles[candles.length - 1].t + INTERVAL_MS > Date.now()
      ) {
        candles.pop();
      }

      return candles;
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`  [${symbol}] fetch deneme ${attempt}/${FETCH_RETRIES} hata: ${msg}`);
      if (attempt < FETCH_RETRIES) {
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }
  }
  throw new Error(
    `${symbol} verisi cekilemedi: ${
      lastErr instanceof Error ? lastErr.message : String(lastErr)
    }`,
  );
}
