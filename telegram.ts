// ============================================================
// TELEGRAM BILDIRIM
// ------------------------------------------------------------
// parse_mode KULLANILMIYOR (bilincli tercih):
// mesajda formatlama yok, ama fiyatlar nokta/tire iceriyor.
// MarkdownV2 bunlarda escape ister; en ufak kacak mesaji
// SESSIZCE dusurur. Duz metin = sifir kirilma riski.
// ============================================================
import { digitsFor } from "./config.ts";
import type { Signal } from "./types.ts";

const TOKEN = Deno.env.get("TELEGRAM_TOKEN");
const CHAT_ID = Deno.env.get("TELEGRAM_CHAT_ID");

export function formatSignal(s: Signal): string {
  const d = digitsFor(s.symbol);
  const f = (x: number) => x.toFixed(d);
  const zaman = new Date(s.triggerTime)
    .toISOString()
    .replace("T", " ")
    .substring(0, 16);
  const gecerli = new Date(s.expiresAt).toISOString().substring(11, 16);

  return [
    "🎯 EXHAUSTION REVERSAL v2.2",
    "",
    `Sembol: ${s.symbol}`,
    `Yön: ${s.direction === "SHORT" ? "🔴 SHORT" : "🟢 LONG"}  (${s.setupType} setup)`,
    `Entry: ${f(s.entry)}`,
    `SL: ${f(s.sl)}`,
    `Risk: ${f(s.riskPt)} puan (1R)`,
    "",
    `ATR: ${s.atr.toFixed(d)}`,
    `Extreme: ${f(s.extreme)}`,
    `Vol Ratio: ${s.volRatio.toFixed(2)}x`,
    `Uzama: ${s.legAtrMult.toFixed(1)}×ATR / ${s.lb} mum`,
    "",
    `⏰ ${zaman} UTC  ·  geçerli ${gecerli} UTC'ye kadar`,
  ].join("\n");
}

/** Mesaji gonderir. Hata firlatmaz — log'lar (bir sembol digerini bozmasin). */
export async function sendTelegram(text: string): Promise<boolean> {
  if (!TOKEN || !CHAT_ID) {
    console.error("  ! TELEGRAM_TOKEN / TELEGRAM_CHAT_ID tanimli degil");
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text,
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error(`  ! Telegram HTTP ${res.status}: ${await res.text()}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`  ! Telegram hata: ${err instanceof Error ? err.message : err}`);
    return false;
  }
}
