// ============================================================
// EXHAUSTION REVERSAL v2.2 — Deno Deploy
// ------------------------------------------------------------
// Cron: her saatin 1. dakikasi (UTC) -> 3 sembol taranir
// Cikti: sadece Telegram. Sheets/journal YOK.
// ============================================================
import { CONFIG, INTERVAL, SYMBOLS } from "./config.ts";
import { fetchCandles } from "./fetcher.ts";
import { detect } from "./detector.ts";
import { cooldownKalan, cooldownYaz, depoDurumu } from "./state.ts";
import { formatSignal, sendTelegram } from "./telegram.ts";
import { isSkip } from "./types.ts";

let sonTarama: { zaman: string; sonuc: string[] } | null = null;

async function tekSembol(symbol: string): Promise<string> {
  try {
    const candles = await fetchCandles(symbol);
    if (candles.length === 0) return `${symbol}: veri yok`;

    const sonMum = new Date(candles[candles.length - 1].t)
      .toISOString()
      .substring(0, 16);

    const r = detect(candles, symbol);

    // --- sinyal yok: sessiz kalma, logla (debug) ---
    if (isSkip(r)) {
      console.log(`  ${symbol}: no signal — ${r.reason} (son mum ${sonMum}, ${candles.length} bar)`);
      return `${symbol}: ${r.reason}`;
    }

    // --- cooldown (seans filtresinden SONRA) ---
    const kalan = await cooldownKalan(symbol, r.direction);
    if (kalan > 0) {
      console.log(`  ${symbol}: no signal — cooldown (${kalan}dk kaldi)`);
      return `${symbol}: cooldown ${kalan}dk`;
    }

    const mesaj = formatSignal(r);
    const ok = await sendTelegram(mesaj);
    if (ok) {
      await cooldownYaz(symbol, r.direction);
      console.log(
        `  ${symbol}: ✅ SINYAL ${r.direction} entry=${r.entry} sl=${r.sl} risk=${r.riskPt.toFixed(4)}`,
      );
      return `${symbol}: SINYAL ${r.direction}`;
    }
    // Telegram basarisizsa cooldown YAZMA -> bir sonraki turda tekrar denenir
    console.error(`  ${symbol}: sinyal uretildi ama Telegram gonderilemedi`);
    return `${symbol}: telegram HATA`;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ${symbol}: HATA — ${msg}`);
    // Hata metnini cevaba da koy: /scan ile dashboard'a bakmadan teshis edilebilsin
    return `${symbol}: HATA — ${msg}`;
  }
}

async function scanAllSymbols(): Promise<string[]> {
  const t0 = Date.now();
  console.log(`\n=== TARAMA ${new Date().toISOString()} (${INTERVAL}) ===`);

  // sirali: bugraapi cold-start'ta paralel istek bogulabiliyor
  const sonuc: string[] = [];
  for (const s of SYMBOLS) {
    sonuc.push(await tekSembol(s));
  }

  console.log(`=== BITTI (${((Date.now() - t0) / 1000).toFixed(1)}sn) ===`);
  sonTarama = { zaman: new Date().toISOString(), sonuc };
  return sonuc;
}

// ------------------------------------------------------------
// CRON — her saatin 1. dakikasi, UTC. 3 retry (1s/5s/10s).
// ------------------------------------------------------------
Deno.cron(
  "hourly-scan",
  "1 * * * *",
  { backoffSchedule: [1000, 5000, 10000] },
  async () => {
    await scanAllSymbols();
  },
);

// ------------------------------------------------------------
// HTTP — health check + manuel tetikleme (debug)
// ------------------------------------------------------------
Deno.serve(async (req) => {
  const { pathname } = new URL(req.url);

  if (pathname === "/health" || pathname === "/") {
    return Response.json({
      status: "ok",
      service: "exhaustion-reversal-v2.2",
      symbols: SYMBOLS,
      interval: INTERVAL,
      blacklistHoursUtc: CONFIG.SESSION_BLACKLIST_HOURS,
      cooldownHours: CONFIG.COOLDOWN_HOURS,
      cooldownDepo: depoDurumu(),
      sonTarama,
      now: new Date().toISOString(),
    });
  }

  // Manuel tarama — cron beklemeden test icin
  if (pathname === "/scan") {
    const sonuc = await scanAllSymbols();
    return Response.json({ ok: true, sonuc });
  }

  return new Response("Not Found", { status: 404 });
});
