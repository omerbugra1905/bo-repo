// ============================================================
// DUMAN TESTI — gercek API + gercek detektor, TELEGRAM YOK
// Amac: sembol adlari, forming bar, uctan uca akis calisiyor mu?
// Calistir: deno run --allow-net --allow-env duman_testi.ts
// ============================================================
import { SYMBOLS } from "./config.ts";
import { fetchCandles } from "./fetcher.ts";
import { detect } from "./detector.ts";
import { formatSignal } from "./telegram.ts";
import { isSkip } from "./types.ts";

console.log(`\n=== DUMAN TESTI  (${new Date().toISOString()}) ===\n`);

for (const symbol of SYMBOLS) {
  console.log(`--- ${symbol} ---`);
  try {
    const t0 = Date.now();
    const mumlar = await fetchCandles(symbol);
    const sure = ((Date.now() - t0) / 1000).toFixed(1);

    if (mumlar.length === 0) {
      console.log(`  ✗ veri bos\n`);
      continue;
    }
    const ilk = new Date(mumlar[0].t).toISOString().substring(0, 16);
    const son = new Date(mumlar[mumlar.length - 1].t).toISOString().substring(0, 16);
    const yas = ((Date.now() - mumlar[mumlar.length - 1].t) / 3600000).toFixed(1);
    console.log(`  ✓ ${mumlar.length} mum (${sure}sn) | ${ilk} -> ${son} | son mum ${yas} saat once`);

    const r = detect(mumlar, symbol);
    if (isSkip(r)) {
      console.log(`  → sinyal yok: ${r.reason}\n`);
    } else {
      console.log(`  → SINYAL ${r.direction} (${r.setupType})`);
      console.log("  --- Telegram mesaji ---");
      console.log(formatSignal(r).split("\n").map((l) => "    " + l).join("\n"));
      console.log();
    }
  } catch (err) {
    console.log(`  ✗ HATA: ${err instanceof Error ? err.message : err}\n`);
  }
}
console.log("=== BITTI (Telegram'a mesaj GONDERILMEDI) ===");
