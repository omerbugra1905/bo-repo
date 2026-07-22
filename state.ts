// ============================================================
// STATE — cooldown (Deno KV)
// Key: ["cooldown", symbol, direction]  Value: epoch ms
// n8n'deki $getWorkflowStaticData yerine kalici KV.
// ============================================================
import { CONFIG } from "./config.ts";

let kvPromise: Promise<Deno.Kv> | null = null;

function kv(): Promise<Deno.Kv> {
  if (!kvPromise) kvPromise = Deno.openKv();
  return kvPromise;
}

const COOLDOWN_MS = CONFIG.COOLDOWN_HOURS * 3_600_000;

/** Cooldown doldu mu? Dolmadiysa kalan dakikayi doner. */
export async function cooldownKalan(
  symbol: string,
  direction: string,
): Promise<number> {
  const db = await kv();
  const res = await db.get<number>(["cooldown", symbol, direction]);
  const last = res.value ?? 0;
  const gecen = Date.now() - last;
  return gecen >= COOLDOWN_MS ? 0 : Math.round((COOLDOWN_MS - gecen) / 60_000);
}

/** Sinyal atildiktan SONRA cooldown'u baslat. */
export async function cooldownYaz(
  symbol: string,
  direction: string,
): Promise<void> {
  const db = await kv();
  await db.set(["cooldown", symbol, direction], Date.now());
}
