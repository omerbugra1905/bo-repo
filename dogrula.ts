// ============================================================
// DOGRULAMA — TS detektor == Python backtest mi?
// ------------------------------------------------------------
// Python harness'in kullandigi AYNI cache CSV'sini okur (birebir girdi),
// her bari "son kapanan mum" gibi gosterip detektoru calistirir,
// uretilen sinyalleri JSON'a yazar.
//
// Sonra karsilastir.py bunu Python backtest girisleriyle kiyaslar.
// BEKLENTI: Python'un her girisi, TS sinyal kumesinin ICINDE olmali.
// (TS her barda bagimsiz calisir; backtest giris sonrasi ileri atlar,
//  o yuzden TS >= Python olmasi normal. Eksik olan = BUG.)
//
// Calistir:  deno run --allow-read --allow-write dogrula.ts
// ============================================================
import { detect } from "./detector.ts";
import { CONFIG } from "./config.ts";
import type { Candle } from "./types.ts";
import { isSkip } from "./types.ts";

const CACHE = "../veri_cache";
const SEMBOLLER = [
  ["XAUUSD", "bugraapi_XAUUSD_1h.csv"],
  ["XAGUSD", "bugraapi_XAGUSD_1h.csv"],
  ["NDX", "bugraapi_NDX_1h.csv"],
];

function parseUtc(dt: string): number {
  const s = dt.trim().replace(" ", "T");
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + "Z").getTime();
}

function csvOku(yol: string): Candle[] {
  const metin = Deno.readTextFileSync(yol).trim();
  const satirlar = metin.split(/\r?\n/);
  const basliklar = satirlar[0].split(",").map((h) => h.trim());
  const idx = (ad: string) => basliklar.indexOf(ad);
  const iDt = idx("datetime"), iO = idx("open"), iH = idx("high"),
    iL = idx("low"), iC = idx("close"), iV = idx("volume");

  const out: Candle[] = [];
  for (let r = 1; r < satirlar.length; r++) {
    const p = satirlar[r].split(",");
    if (p.length < 5) continue;
    const c: Candle = {
      t: parseUtc(p[iDt]),
      o: parseFloat(p[iO]),
      h: parseFloat(p[iH]),
      l: parseFloat(p[iL]),
      c: parseFloat(p[iC]),
      v: iV >= 0 ? (parseFloat(p[iV]) || 0) : 0,
    };
    if (Number.isFinite(c.t) && Number.isFinite(c.c)) out.push(c);
  }
  out.sort((a, b) => a.t - b.t);
  return out;
}

const cikti: Record<string, string[]> = {};

for (const [sembol, dosya] of SEMBOLLER) {
  const yol = `${CACHE}/${dosya}`;
  let mumlar: Candle[];
  try {
    mumlar = csvOku(yol);
  } catch {
    console.log(`${sembol}: cache yok (${yol}) — atlandi`);
    continue;
  }

  const sinyaller: string[] = [];
  const nedenler = new Map<string, number>();

  // Python'un ilk girebilecegi bar: setup i=ATR_PERIOD+5 -> trigger i+1
  const ilkBar = CONFIG.ATR_PERIOD + 6;
  for (let end = ilkBar; end < mumlar.length; end++) {
    // NOT: forming-bar temizligi burada YOK — CSV zaten kapali mumlar.
    const r = detect(mumlar.slice(0, end + 1), sembol);
    if (isSkip(r)) {
      const k = r.reason.split("(")[0].trim();
      nedenler.set(k, (nedenler.get(k) ?? 0) + 1);
    } else {
      sinyaller.push(new Date(r.triggerTime).toISOString().substring(0, 19));
    }
  }

  cikti[sembol] = sinyaller;
  console.log(`\n=== ${sembol} ===`);
  console.log(`  ${mumlar.length} mum, ${mumlar.length - ilkBar} bar tarandi`);
  console.log(`  TS SINYAL: ${sinyaller.length}`);
  for (const [k, v] of [...nedenler].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${k.padEnd(20)} ${v}`);
  }
}

Deno.writeTextFileSync("ts_sinyaller.json", JSON.stringify(cikti, null, 2));
console.log("\n=> ts_sinyaller.json yazildi. Simdi: python karsilastir.py");
