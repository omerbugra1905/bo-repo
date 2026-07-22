# Exhaustion Reversal v2.2 — Deno Deploy

n8n'den taşınan canlı sinyal botu. Her saat başı +1 dk çalışır, 3 sembolü tarar,
setup bulursa Telegram'a sinyal atar.

> **Durum:** Detektör, Python backtest'iyle **birebir doğrulandı** —
> 715 backtest girişinin tamamı TS detektöründe de üretiliyor (`karsilastir.py`).

## Ne yapar

| | |
|---|---|
| Semboller | XAUUSD, NAS100USD, XAGUSD |
| Timeframe | H1 |
| Veri | `bugraapi.onrender.com/candles/{symbol}/1h?n=50` |
| Cron | `1 * * * *` (her saatin 1. dk, **UTC**) |
| Çıktı | Sadece Telegram (Sheets/journal yok) |
| State | Deno KV — cooldown |

## Sistem mantığı (dokunma — doğrulanmış)

1. **Setup**: son 3-8 mumda 3.5+ ATR aşırı uzama + hacim (2. yarı ≥ 1.1× 1. yarı)
2. **Tetikleyici**: setup sonrası 3 mum içinde ilk ters mum
3. **Seans filtresi**: tetikleyici UTC saati `[1,2,3,5,7,10]` ise **atma**
4. **Cooldown**: aynı sembol+yön için 4 saat
5. **SL**: ekstrem ± ATR×0.15 · **Entry**: tetikleyici mum kapanışı

> ⚠️ **Sıra önemli:** seans filtresi cooldown'dan **önce** çalışır — elenen bir
> sinyal cooldown'u tüketmez. (n8n'deki davranış birebir korundu.)

## Kritik detaylar

- **ATR = 14 periyot SMA** (Wilder değil) — backtest ile aynı olmalı
- **Forming bar atılır**: kapanmamış son mum `t + 3600000 > now` ise pop edilir
- **UTC parse**: `"2026-01-01T00:00:00"` gibi timezone'suz string JS'te **yerel**
  saat sayılır. Açıkça `Z` eklenerek UTC'ye sabitlendi (n8n'de sunucu UTC olduğu
  için sorun çıkmıyordu, artık garanti)
- **Telegram `parse_mode` yok**: fiyatlardaki nokta/tire MarkdownV2'de escape
  ister, en ufak kaçak mesajı sessizce düşürür. Düz metin = sıfır risk

## Kurulum (yerel test)

```bash
deno task check      # tip kontrolü
deno task dogrula    # detektörü cache verisiyle doğrula -> ts_sinyaller.json
python karsilastir.py   # Python backtest ile kıyasla (üst klasörde bt/ olmalı)
deno task dev        # localhost:8000
```

Env (yerel için `.env` veya shell):
```
TELEGRAM_TOKEN=...
TELEGRAM_CHAT_ID=-1003783273701
```

## Deploy (Deno Deploy)

1. GitHub'a repo aç: `exhaustion-reversal-deno`, kodu push et
2. [deno.com/deploy](https://deno.com/deploy) → GitHub ile bağlan
3. Repo'yu seç, **entry point: `main.ts`**
4. **Settings → Environment Variables**:
   - `TELEGRAM_TOKEN`
   - `TELEGRAM_CHAT_ID` = `-1003783273701`
5. Deploy → cron otomatik keşfedilir ve dashboard'da görünür

> Deno Deploy cron'ları **deploy anında** keşfeder ve UTC'ye göre çalıştırır.
> KV ayrıca kurulum istemez, `Deno.openKv()` argümansız çalışır.

## Endpointler

| Yol | İş |
|---|---|
| `/health` | durum + son tarama sonucu |
| `/scan` | manuel tarama (cron beklemeden test) |

## Başarı kriteri (ilk 24 saat)

- Her saat log düşmeli; setup yoksa `no signal — setup yok` yazmalı (sessiz kalmamalı)
- En az bir saatlik döngü hatasız tamamlanmalı
- Sinyal geldiğinde Telegram'a düşmeli, cooldown KV'ye yazılmalı

## Yapılmayacaklar

- Google Sheets / journal (şimdilik yok)
- Yeni sembol (sadece 3'ü)
- Parametre değişikliği (doğrulanmış)
- Sweep tetikleyicisi (sistemi bozuyor — YASAK)
- H4 alignment vb. "iyileştirme"

## Dosyalar

```
main.ts        cron + health/scan endpoint
config.ts      sabitler (dokunma)
detector.ts    setup + tetikleyici + seans filtresi
indicators.ts  ATR (SMA)
fetcher.ts     bugraapi + retry + forming bar
telegram.ts    bildirim
state.ts       KV cooldown
dogrula.ts     detektör doğrulama (cache verisi)
karsilastir.py Python backtest ile kıyas
```
