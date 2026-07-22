// ============================================================
// TIPLER
// ============================================================

/** Normalize edilmis mum (t = UTC epoch ms) */
export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Tespit edilen setup */
export interface Setup {
  type: "TEPE" | "DIP";
  isShort: boolean;
  atr: number;
  extreme: number;
  /** bacak kac mumluk */
  lb: number;
  /** setup, tetikleyiciden kac mum once */
  sinceSetup: number;
  volRatio: number;
  legAtrMult: number;
}

/** Telegram'a gidecek nihai sinyal */
export interface Signal {
  symbol: string;
  direction: "LONG" | "SHORT";
  setupType: "TEPE" | "DIP";
  entry: number;
  sl: number;
  riskPt: number;
  atr: number;
  extreme: number;
  volRatio: number;
  legAtrMult: number;
  lb: number;
  triggerTime: number;
  expiresAt: number;
}

/** Sinyal yoksa neden atlandigi (debug logu icin) */
export interface Skip {
  skip: true;
  reason: string;
}

export type DetectResult = Signal | Skip;

export function isSkip(r: DetectResult): r is Skip {
  return (r as Skip).skip === true;
}
