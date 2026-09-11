# QTERMINAL merge — design

**Date:** 2026-09-11
**Status:** Approved for planning
**Repo:** `/Users/kaye/Projects/quokka` → `github.com/Kaye999/quokka` → `quokka-eta.vercel.app`
**Prototype:** `github.com/qqquokkacoin-ui/qterminal` (verified byte-identical to its GitHub Pages deploy)

> **Revision note.** An earlier draft of this spec was built on the assumption that
> prices came from GeckoTerminal DEX pools, which covered only ~6 names. That was the
> wrong source. Robinhood's issuer API serves the entire tokenised universe directly.
> §3 is rewritten around that; the heatmap is no longer starved of data.

---

## 1. What this is

Fold the QTERMINAL prototype into this Next.js repo so QTERMINAL becomes the front of
the site, with the $QOKA narrative directly below it on the same page.

The prototype contributes its **shell and presentation**. This repo contributes its
**real data spine**. Nothing from the prototype's data layer survives.

### The core finding that shapes everything

The prototype's `js/market.js` fabricates every number it displays. A seeded PRNG
(`mulberry32(seedFromString(ticker + dayStamp()))`) generates price, open, high, low,
volume and all candles. `USE_LIVE_FETCH` is `false`. `getFundamentals()` invents next
earnings dates, EPS estimates, beat/miss history, dividend yields, ex-dividend dates,
analyst buy/hold/sell splits, price targets and news headlines. The one "live" path —
Yahoo Finance through the public CORS proxy `api.allorigins.win` — falls back to the
mock engine **silently** on any failure, so it can render invented prices while
appearing live.

The prototype's own README is candid about this, and about one thing in particular:

> The `tokenized` flag per ticker is a placeholder guess, not a live lookup against
> Robinhood's actual Stock Tokens catalog.

That is the entire merge in a sentence. `getRegistry()` in this repo **is** that live
lookup. This design does not override the prototype's intent — it completes it.

**`js/market.js` is not ported. It is deleted at the door.** Every number the merged
terminal shows must trace to a named upstream source and carry a UTC sync time. Where
no honest source exists, the surface is cut — never filled with a plausible placeholder.

---

## 2. Decisions locked

| # | Decision | Choice |
|---|----------|--------|
| 1 | Data spine | Real data only. Surfaces with no honest source are cut from V1, not simulated. |
| 2 | Ticker | **$QOKA**, per `lib/config.ts` (`symbol: "QOKA"`, `0xC49137AE3d0055431Ee4d95a66E36C47666CC43C`). The prototype's `coin-config.js` (`$QUOKKA`, empty CA) is a stale placeholder and is ignored. |
| 3 | Site structure | One page at `/`: full-screen starfield landing, `PRESS TO ENTER` → `/terminal`, a `▼ $QOKA` arrow scrolling to the narrative rendered below in the same document. |
| 4 | Existing routes | Absorbed. `/terminal`, `/terminal/the-100`, `/terminal/verify`, `/terminal/asset/[symbol]` keep their URLs and become views inside one shared shell. |
| 5 | Universe | **Nasdaq-100 + QQQ, Robinhood as the only issuer.** The 153 tokenised off-index names are out of scope. |
| 6 | Visual | Two registers over one shared token layer. Terminal = hard mono instrument. $QOKA = warm boardroom. Shared accent hue, up/down colours, spacing scale. |
| 7 | Tile fill | **No % change in V1.** There is no honest source for it — see §3.3 and §11. |
| 8 | Tile size | Hand-maintained `marketCapB`, as-of dated, geometry only. |
| 9 | Underlying equity prices | **Parked** pending market-data redistribution terms. See §11. |

---

## 3. Data inventory — what is actually true

All figures measured against live endpoints on 2026-09-11.

### 3.1 The universe

| | count |
|---|---|
| Robinhood tokenised assets (all) | 194 |
| **…that are Nasdaq-100 constituents** | **41** |
| Nasdaq-100 names with no token yet | **59** |
| Tokenised but off-index — **out of scope** | 153 |

QQQ and SPY are both tokenised. The off-index 153 includes non-Nasdaq names (BA, CCL,
BABA, AMC, ASML), which is why decision #5 excludes them — they would break the
"NASDAQ-100 · TOKENIZED" framing.

**41 of 100 tokenised is the headline coverage figure.** The 59 that are not are not a
gap in the product; they are the product's subject.

### 3.2 The Robinhood issuer API

Base `https://api.robinhood.com/rhj`. Three endpoints exist — `assets`, `prices`,
`corporate-actions`. **There is no history endpoint** (verified: `historicals`,
`history`, `candles`, `ohlc`, `charts`, `quotes` all 404).

**Critical: the batch and per-symbol price endpoints return different fields.**
Verified at identical `generatedAt` timestamps with matching bids:

| endpoint | bid/ask | dailyHigh | dailyLow | dailyTradingVolume |
|---|---|---|---|---|
| `GET /rhj/prices` (all 194, one call) | real | **0** | **0** | **0** |
| `GET /rhj/prices/{SYM}` (one symbol) | real | real | real | real |

This dictates the fetch strategy:

- **One batch call** → bid/ask/mid for all 194. Feeds the sidebar and the heatmap.
- **One per-symbol call** → adds day high/low and volume. Feeds the asset detail only.

The current adapter (`lib/providers/robinhood.ts`) **discards `dailyHigh` and
`dailyLow`**. They must be added to `StockTokenQuote`.

### 3.3 What does not exist

- **No previous close, anywhere in the Robinhood API.** Therefore **no honest % change**,
  and therefore no heatmap fill in V1 (decision #7). Do not derive one from `dailyHigh`,
  `dailyLow`, or a remembered mid, and do not present a day-range position as if it were
  a daily change.
- **No candles**, except from GeckoTerminal for the handful of tokens with DEX pools.
  The chart is therefore available on *some* asset pages, not all. This is a known and
  accepted V1 limitation; a page without a chart omits the panel rather than showing an
  empty frame.

### 3.4 GeckoTerminal (secondary)

Still used, but demoted — it is no longer the price source.

- Onchain DEX price, 24h volume, liquidity, pool address for names with pools.
- **Real OHLCV candles** per pool. Verified:
  `GET /api/v2/networks/robinhood/pools/{pool}/ohlcv/hour?limit=10` →
  `[1789081200, 1.00029…, 1.00618…, 0.99113…, 1.00013…, 21355855.14]`.
- Free tier ~30 req/min. `getDesk()` already paginates sequentially for this reason.

**Known defect to fix in Phase 2.** `getDesk()` scans only the first 5 pages of pools
ranked by GeckoTerminal, so a real listing can fall out of the window between syncs.
Two `/api/desk` calls minutes apart on 2026-09-11 returned different sets
(`AAPL AMZN GOOGL NVDA` then `AAPL COST GOOGL HOOD MSFT NVDA`). **A tile must never flip
from "has a market" to "no market" on a refresh and present that as a market event.**
Fix by looking pools up by contract address from the registry — deterministic, and the
registry already knows every address. Record the chosen approach in this spec.

### 3.5 Market cap for tile geometry

`Constituent` has no market cap and the prototype's `marketCapB` is self-described as
"rough order-of-magnitude, not a live figure". Tiles still need a size input.

Add `marketCapB?: number` to `Constituent` in `lib/nasdaq100.ts`, hand-maintained
alongside the constituent list and governed by a new `NASDAQ_100_MARKET_CAP_AS_OF`
constant. Used **only** for tile geometry, never rendered as a figure, and disclosed in
the heatmap's `Sources` block as approximate and as-of dated. Constituents without a
value get the smallest tile. This mirrors how the repo already treats the constituent
list: hand-maintained data with an explicit as-of date.

---

## 4. Architecture

### Chosen approach: server components + small client islands

Port the prototype's markup and CSS into React. Data is fetched server-side, so the
terminal renders real numbers into the HTML. Client JS appears only where interaction
demands it. The URL remains the source of view state, preserving deep links, per-route
metadata, and the UTC timestamp work from 2026-09-07.

**Rejected — static app under `/public`:** two apps, no server data, no SEO on the
terminal, contradicts decision #4.

**Rejected — one large client component hydrating from a snapshot:** conflicts with the
repo's small-focused-file convention, ships more JS, loses per-view server rendering,
and the only thing it buys is the cosmetic tick (see §6).

### Route map

All terminal routes share one chrome through `app/terminal/layout.tsx`; each page
supplies only its main pane.

```
/                       starfield landing + ▼$QOKA → narrative below, same document
/terminal               shell · QQQ view — the index anchor AND the heatmap
/terminal/the-100       shell · the 100 board
/terminal/verify        shell · verify tool
/terminal/asset/[sym]   shell · asset detail
```

**Per the prototype's README, the heatmap belongs to the QQQ view, not to a separate
index route.** QQQ is pinned at the top of the sidebar and is the default landing view
of the terminal. Every other ticker shows the detail panels instead.

### Modules

```
app/
  page.tsx                     landing + $QOKA narrative (server)
  terminal/layout.tsx          shared shell: topbar + sidebar (server)
  terminal/page.tsx            QQQ view + heatmap
  terminal/the-100/page.tsx    board view        (reparented, URL unchanged)
  terminal/verify/page.tsx     verify view       (reparented, URL unchanged)
  terminal/asset/[symbol]/     detail view       (reparented, URL unchanged)

lib/
  terminal/board.ts            NEW — merges registry + batch prices + desk to TerminalRow
  server/candles.ts            NEW — GeckoTerminal OHLCV fetch + parse
  providers/robinhood.ts       + getQuotes() batch; + dailyHigh/dailyLow on quotes
  nasdaq100.ts                 + marketCapB, + NASDAQ_100_MARKET_CAP_AS_OF

components/terminal/
  shell/topbar.tsx             logo, "NASDAQ-100 · TOKENIZED", UTC clock
  shell/sidebar.tsx            server-rendered list, QQQ pinned top
  shell/sidebar-search.tsx     client — filter input
  heatmap.tsx                  server-rendered sector-grouped tiles
  heatmap-tooltip.tsx          client — hover readout
  candle-chart.tsx             client — canvas chart + range buttons
components/landing/
  starfield.tsx                client — canvas
  enter-button.tsx             client — to /terminal
  qoka-arrow.tsx               client — smooth scroll to narrative
```

### The single row type

```ts
export type TokenState = "tokenized" | "waiting";

export type TerminalRow = {
  symbol: string;
  company: string;
  sector: Sector;
  /** Tile geometry only. Approximate, as-of dated. Never displayed as a figure. */
  marketCapB?: number;

  /** Real, from getRegistry() — replaces the prototype's guessed flag. */
  state: TokenState;

  asset?: StockTokenAsset;   // registry: contract, decimals, multiplier
  quote?: StockTokenQuote;   // issuer: bid/ask/mid (batch) — tokenized only
  listing?: DeskListing;     // GeckoTerminal: onchain market — pooled only

  /** Deliberately absent in V1. There is no honest source. Do not add
   *  this field until §11's licensing item is resolved. */
  // changePercent24h?: number;
};

export type TerminalBoard = {
  /** The 100 constituents. What the heatmap renders. */
  constituents: TerminalRow[];
  /** QQQ — the index anchor, pinned top of sidebar, default view. */
  index?: TerminalRow;
};
```

Built by a pure function `buildTerminalBoard(registry, quotes, desk)` — no fetching,
fully testable offline, mirroring the existing `buildBoard()` convention.

---

## 5. What is cut, and what replaces it

The prototype's asset detail carries four fabricated cards. They are removed and
replaced with cards this repo can fill truthfully.

| Removed (fabricated) | Replacement (real, sourced) |
|---|---|
| Earnings — date, EPS estimate, beat/miss history | **Corporate actions** — real splits and dividends from the issuer, with type, status, process date |
| Dividend — yield, ex-div date, per-share history | **Issuer quote** — bid, ask, mid, **day high/low**, daily volume, halt status, `generatedAt` |
| Analyst — target price, buy/hold/sell split | **Contract & deployments** — address, chain, decimals, current/pending multiplier, explorer link |
| News — generated headlines | **Onchain market** — DEX price, 24h volume, liquidity, pool link (pooled names only) |

A swap, not a deletion. It is the difference between a mock-up of a terminal and a
terminal.

### The heatmap in V1

Three visual dimensions, two of them real and one deliberately switched off:

- **Size** — `marketCapB`, approximate and as-of dated (§3.5).
- **Border** — tokenized (green) vs not yet (grey). **Real**, from `getRegistry()`. This
  is the prototype's stated intent, finally backed by a live lookup.
- **Fill** — the day's % change. **Off in V1.** No honest source (§3.3).

With 41 of 100 tokenized, the border split carries the whole story on its own, and the
board visibly fills in as Robinhood releases more names.

---

## 6. Honest liveness

The prototype ticks every 2500ms via `subscribeTick`, nudging prices by a random walk.
Against real data on a 30s–300s revalidate, a ticking number is a better-looking lie.

- The topbar clock is a real UTC clock — that part is genuinely live.
- Every view keeps the existing `Sources` block with `Last sync: <UtcTime>`.
- A `STALE` marker appears when a sync is older than twice its revalidate window.
- All timestamps go through `formatUtc()` / `<UtcTime>` per the 2026-09-07 UTC work.
  Never reintroduce `toLocaleString`, `en-AU`, or `Australia/Sydney`.

---

## 7. Visual system

One `:root` token layer in `app/globals.css`. The terminal register is scoped under
`.term-app`; the narrative keeps the existing boardroom register.

**Shared:** up/down colours (`--up: #3dcc7a`, `--down: #e05a4f`), the spacing scale, the
`clamp()` type scale, and a reconciled accent hue — brass `#d4af37` and the prototype's
amber `#ffb238` are close enough to unify without either section losing character.

**Terminal-only, scoped to `.term-app`:** true black `#000`, `--radius: 2px`, mono
throughout, `--amber` for data text, Robinhood green `#00c805` for the tokenized border.

**Font.** `fonts/Excess_V_Straight.otf` is committed to the prototype repo (37KB). It is
a licensed typeface — **do not ship it** without confirmation from Ethan that the licence
permits web embedding. Until then use the mono stack (`"JetBrains Mono",
"IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace`). Swapping it in later is
one `@font-face` block.

---

## 8. Non-functional requirements

**Mobile is compulsory** — verify at 320 / 360 / 390 / 430 / 768 / 1024 / 1280 / 1440.
`scripts/responsive-audit.mjs` is the gate; add the new landing and shell to its
`ROUTES`. All type via `clamp()`; no `text-[Npx]`.

**The 820px split.** Per the prototype, below 820px the sidebar and the detail pane
become two separate full-screen views with a `← BACK TO LIST` button, rather than a
side-by-side split. Match that breakpoint.

**Starfield performance.** Cap `devicePixelRatio` at 2, pause the RAF loop when the
canvas is offscreen or the tab is hidden, and render a static gradient under
`prefers-reduced-motion: reduce`. The landing is the first thing a phone loads.

**Rate limits.** One batch price call per revalidate window, not 194. Per-symbol quotes
and OHLCV only on the detail route, cached with `next: { revalidate }`. Never fan either
out across the heatmap.

**Degradation.** An upstream outage degrades the terminal, it never breaks it. Follow the
existing `EMPTY_REGISTRY` pattern: catch, return an empty snapshot with `ok: false`, let
`Sources` report `unavailable`. **Never fall back to generated data** — that is the exact
failure mode this design exists to prevent.

**Accessibility.** `PRESS TO ENTER` and the `▼ $QOKA` arrow are real focusable buttons
with accessible names. Heatmap tiles are keyboard-reachable links. The tooltip is
supplementary, never the only route to a value.

---

## 9. Testing

| Area | Test |
|---|---|
| `lib/terminal/board.ts` | returns exactly 100 constituent rows; `state` is `tokenized` iff the registry has an active asset; QQQ lands in `index` not `constituents`; an off-index tokenised asset appears nowhere; **no change/percent field is ever populated** |
| `lib/providers/robinhood.ts` | `getQuotes()` parses the batch shape; `dailyHigh`/`dailyLow` survive the per-symbol parse; batch zeros are normalised to `undefined`, never rendered as a real `0` |
| `lib/server/candles.ts` | OHLCV tuple parse; empty list; non-200; malformed body gives `[]`, never a throw |
| Pool drift | a ticker present in one desk snapshot and absent from the next does not flip to a "no market" state |
| `lib/time.ts` | existing UTC suite keeps passing under four `TZ` values |
| Routing | all four terminal URLs render inside the shell and return 200 |
| Responsive | `scripts/responsive-audit.mjs` green across 8 widths × all routes |
| Motion | starfield renders static under `prefers-reduced-motion` |

Every phase lands with `npm test`, `npm run lint`, `npx tsc --noEmit` and the responsive
audit green before the next begins.

---

## 10. Build order

Five phases, each independently shippable, each leaving the site working.

1. **Token layer** — shared `:root` tokens and the `.term-app` register in
   `globals.css`. No behaviour change; existing pages must render identically.
2. **Data** — batch `getQuotes()`, `dailyHigh`/`dailyLow` on the quote type,
   `lib/terminal/board.ts`, `lib/server/candles.ts`, `marketCapB` on `Constituent`,
   and the §3.4 pool-drift fix. All with tests. No UI.
3. **Shell** — `app/terminal/layout.tsx` with topbar and sidebar (QQQ pinned); the three
   existing terminal pages reparented into it, URLs unchanged.
4. **Views** — QQQ view with the heatmap, and asset detail rebuilt with the four real
   cards plus the candle chart where a pool exists.
5. **Front door** — new `/`: starfield landing, `PRESS TO ENTER`, `▼ $QOKA` arrow, with
   the existing homepage content reparented below as the narrative section.

---

## 11. Out of scope for V1

Recorded as decisions, not omissions.

### Underlying-equity prices and % change — parked, not abandoned

Alpaca's snapshot endpoint supplies exactly what a Bloomberg-style daily change needs:
`prevDailyBar.c` is the previous session's official close, `latestTrade.p` the last
price, batched across symbols. Verified 2026-09-11:

| | last | prev close | daily % |
|---|---|---|---|
| NVDA | 218.37 | 223.77 | −2.41% |
| AAPL | 326.07 | 315.42 | +3.38% |
| MSFT | 492.49 | 491.65 | +0.17% |
| QQQ | 708.95 | 716.35 | −1.03% |

This would give a real % change for **all 100** constituents — tokenised or not — with
no database, and would also expose the spread between the underlying and the token,
which is the tokenisation premium/discount.

**Blocked on licensing, by Ethan's decision.** Publishing a market-data feed on a public
site is contractually distinct from consuming it in a private trading bot. Do not wire
Alpaca into the site until redistribution terms are confirmed in writing.

Two notes for whoever picks this up: the default feed is `iex`, a single exchange
carrying roughly 2.5% of the tape — NVDA showed 2,640,914 shares on `iex` against
107,667,710 on `delayed_sip` for the same session, so `iex` would make every volume
figure wrong by ~97%. Use `delayed_sip`, and attribute it.

### Also out of scope

- **Off-index tokenised names** — the other 153 Robinhood tokens (decision #5).
- **Paid equities fundamentals** — genuine earnings, dividends, analyst consensus, news.
- **Command line** — a real Bloomberg-style command input.
- **Live tick** — sub-minute updates would need a streaming source; all current
  upstreams are REST on a 30s+ cache.

---

## 12. Open items

- **Font licence** for `Excess_V_Straight.otf`. Blocks nothing; the mono stack ships
  until confirmed.
- **`marketCapB` values** for the 100 constituents. The prototype's numbers can seed
  this, but each is approximate and `NASDAQ_100_MARKET_CAP_AS_OF` must say so honestly.
- **Alpaca redistribution terms** — see §11. Gates the heatmap's fill dimension.
