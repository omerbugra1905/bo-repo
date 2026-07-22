// ============================================================
// STATE — cooldown
// ------------------------------------------------------------
// Kalici depo: Deno KV  (yeni Deno Deploy'da app'e ayrica
// "Databases -> Provision -> Deno KV" ile baglanmali).
//
// TASARIM KURALI: cooldown ASLA sinyali engellemez.
// KV yoksa/patlarsa bellege duser ve sinyal gonderilmeye devam eder.
// Cooldown kacirmak kotu; SINYAL kacirmak cok daha kotu.
// ============================================================
import { CONFIG } from "./config.ts";

const COOLDOWN_MS = CONFIG.COOLDOWN_HOURS * 3_600_000;

/** KV yoksa devreye giren yedek (izolasyon omru boyunca yasar) */
const bellek = new Map<string, number>();

let kv: Deno.Kv | null = null;
let kvDenendi = false;

async function kvAl(): Promise<Deno.Kv | null> {
  if (kvDenendi) return kv;
  kvDenendi = true;
  try {
    if (typeof Deno.openKv !== "function") {
      console.warn("  ! Deno KV yok (app'e KV database baglanmamis) — cooldown BELLEKTE tutulacak");
      return null;
    }
    kv = await Deno.openKv();
    return kv;
  } catch (err) {
    console.warn(
      `  ! Deno KV acilamadi (${err instanceof Error ? err.message : err}) — cooldown BELLEKTE`,
    );
    kv = null;
    return null;
  }
}

const anahtar = (symbol: string, direction: string) => `${symbol}_${direction}`;

/** Cooldown dolmadiysa kalan dakika, dolduysa 0. Hata durumunda 0 (= engelleme). */
export async function cooldownKalan(symbol: string, direction: string): Promise<number> {
  let son = 0;
  try {
    const db = await kvAl();
    if (db) {
      const res = await db.get<number>(["cooldown", symbol, direction]);
      son = res.value ?? 0;
    } else {
      son = bellek.get(anahtar(symbol, direction)) ?? 0;
    }
  } catch (err) {
    console.warn(`  ! cooldown okunamadi (${err instanceof Error ? err.message : err}) — gecildi`);
    return 0; // okuyamiyorsak sinyali ENGELLEME
  }
  const gecen = Date.now() - son;
  return gecen >= COOLDOWN_MS ? 0 : Math.round((COOLDOWN_MS - gecen) / 60_000);
}

/** Sinyal gonderildikten SONRA cooldown baslat. Hata yutulur (sinyal zaten gitti). */
export async function cooldownYaz(symbol: string, direction: string): Promise<void> {
  const simdi = Date.now();
  bellek.set(anahtar(symbol, direction), simdi); // her halukarda bellege yaz
  try {
    const db = await kvAl();
    if (db) await db.set(["cooldown", symbol, direction], simdi);
  } catch (err) {
    console.warn(`  ! cooldown yazilamadi (${err instanceof Error ? err.message : err})`);
  }
}

/** /health icin: cooldown nerede tutuluyor? */
export function depoDurumu(): string {
  if (!kvDenendi) return "henuz denenmedi";
  return kv ? "Deno KV (kalici)" : "bellek (KV yok — restart'ta sifirlanir)";
}
