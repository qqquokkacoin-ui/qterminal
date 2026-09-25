# QTERMINAL Merge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make QTERMINAL the front of quokka-eta.vercel.app — a real Nasdaq-100 tokenisation terminal driven entirely by live issuer data — with the $QOKA narrative directly below it on the same page.

**Architecture:** Next.js 16 App Router. Terminal routes share one chrome via `app/terminal/layout.tsx`; data is fetched server-side and rendered into HTML, with client components only for canvas, hover and filter interactions. The prototype's `js/market.js` is discarded entirely and replaced by this repo's existing Robinhood issuer registry plus a new batch-quote call.

**Tech Stack:** Next.js 16.3.4, React 19.2.8, TypeScript 5.9, vitest 4, viem, plain CSS custom properties (no Tailwind, no CSS-in-JS).

**Spec:** `docs/superpowers/specs/2026-09-11-qterminal-merge-design.md` — read it before Task 1. This plan argues from it; both travel together.

**Prototype source:** `https://github.com/qqquokkacoin-ui/qterminal` — clone it read-only to port markup and CSS. Verified byte-identical to its GitHub Pages deploy. Files referenced below by path within that clone.

---

## Global Constraints

These apply to every task. No task may violate them.

- **Never render a number without a real upstream source.** If a value is unavailable, omit the panel or render `—`. Never generate, estimate, extrapolate, or carry forward a stale value as current. This is the entire reason the project exists.
- **`js/market.js` is never ported**, in whole or in part, including its PRNG, its `getFundamentals`, and its `fetchLiveQuote` CORS-proxy path.
- **No `changePercent` / `change24h` field may be added to `TerminalRow`** in V1. There is no honest source for the equity daily change (spec §3.3, §11).
- **All timestamps** go through `formatUtc()` / `<UtcTime>` from `lib/time.ts`. Never `toLocaleString`, never `en-AU`, never `Australia/Sydney`.
- **Mobile is compulsory.** Verify at 320 / 360 / 390 / 430 / 768 / 1024 / 1280 / 1440. All type via `clamp()`.
- **The terminal/detail split breakpoint is 820px**, matching the prototype.
- **Every phase ends green:** `npm test`, `npm run lint`, `npx tsc --noEmit`, and `scripts/responsive-audit.mjs` all pass before the next phase starts.
- **Never commit `tsconfig.tsbuildinfo`.** It is tracked but is a build artifact; `git checkout -- tsconfig.tsbuildinfo` before committing.
- **Deploys are automatic.** `git push origin main` triggers a production deploy on Vercel. Do not run `vercel --prod`.
- Existing verbatim values that must not drift: `--up: #3dcc7a`, `--down: #e05a4f`, `--brass: #d4af37`, prototype amber `#ffb238`, Robinhood green `#00c805`, `NASDAQ_100_AS_OF = "2026-06-22"`, QOKA contract `0xC49137AE3d0055431Ee4d95a66E36C47666CC43C`.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `lib/terminal/board.ts` | Pure merge of registry + quotes + listings into `TerminalBoard`. No fetching. |
| `lib/terminal/board.test.ts` | Tests for the above. |
| `lib/server/candles.ts` | GeckoTerminal OHLCV fetch + pure parse. |
| `lib/server/candles.test.ts` | Tests for the pure parse half. |
| `app/terminal/layout.tsx` | Shared terminal chrome: topbar + sidebar. |
| `components/terminal/shell/topbar.tsx` | Logo, strapline, UTC clock. |
| `components/terminal/shell/utc-clock.tsx` | Client — ticking UTC clock. |
| `components/terminal/shell/sidebar.tsx` | Server — ticker list, QQQ pinned. |
| `components/terminal/shell/sidebar-search.tsx` | Client — filter input. |
| `components/terminal/heatmap.tsx` | Server — sector-grouped tiles. |
| `components/terminal/heatmap-tooltip.tsx` | Client — hover readout. |
| `components/terminal/candle-chart.tsx` | Client — canvas chart + range buttons. |
| `components/landing/starfield.tsx` | Client — canvas starfield. |
| `components/landing/qoka-arrow.tsx` | Client — scroll to narrative. |
| `components/qoka/narrative.tsx` | Server — the $QOKA story, extracted from today's homepage. |

**Modified:**

| File | Change |
|---|---|
| `lib/providers/types.ts` | `dailyHigh`/`dailyLow` on `StockTokenQuote`; `getQuotes()` on the provider interface. |
| `lib/providers/robinhood.ts` | Export `toQuote()`; add `getQuotes()` batch; stop discarding high/low. |
| `lib/nasdaq100.ts` | `marketCapB?` on `Constituent`; `NASDAQ_100_MARKET_CAP_AS_OF`. |
| `lib/server/registry.ts` | `getQuotes()` passthrough. |
| `lib/server/desk.ts` | Pool lookup by contract address (fixes drift). |
| `app/globals.css` | Shared token layer + `.term-app` register. |
| `app/page.tsx` | Becomes landing + narrative. |
| `app/terminal/page.tsx` | Becomes the QQQ view + heatmap. |
| `app/terminal/the-100/page.tsx`, `verify/page.tsx`, `asset/[symbol]/page.tsx` | Drop their own `TerminalHeader`; inherit the shell. |
| `scripts/responsive-audit.mjs` | Add new routes. |

---

# Phase 1 — Token layer

### Task 1: Shared tokens and the `.term-app` register

**Files:**
- Modify: `app/globals.css` (append a new section; do not edit existing `:root`)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties available under `.term-app` — `--qt-bg`, `--qt-panel`, `--qt-panel-alt`, `--qt-border`, `--qt-border-strong`, `--qt-amber`, `--qt-amber-dim`, `--qt-text`, `--qt-text-dim`, `--qt-text-faint`, `--qt-green`, `--qt-grey-tag`, `--qt-mono`, `--qt-radius`. Every later task styles terminal UI with these.

**Why prefixed:** the prototype's raw names (`--bg`, `--panel`, `--text`, `--border`) are generic enough to collide with future work in the boardroom register. Prefixing costs nothing and removes the whole class of bug.

- [ ] **Step 1: Append the terminal register to `app/globals.css`**

Add at the end of the file:

```css
/* ============================================================================
   QTERMINAL register.
   The boardroom palette above is the $QOKA narrative's. This is the
   instrument's: true black, hard 2px corners, mono throughout, amber data
   text. Scoped to .term-app so the two can sit in one document without
   either bleeding into the other. --up and --down are deliberately NOT
   redefined — direction colour means the same thing in both rooms.
   ========================================================================== */
.term-app {
  --qt-bg: #000000;
  --qt-panel: #070707;
  --qt-panel-alt: #0c0c0c;
  --qt-border: #262626;
  --qt-border-strong: #3a3a3a;

  --qt-amber: #ffb238;
  --qt-amber-dim: #8a6218;
  --qt-text: #d4d4d4;
  --qt-text-dim: #7a7a7a;
  --qt-text-faint: #4d4d4d;

  --qt-green: #00c805;
  --qt-grey-tag: #5a5a5a;

  --qt-mono: "JetBrains Mono", "IBM Plex Mono", ui-monospace, "SF Mono", Consolas, monospace;
  --qt-radius: 2px;

  background: var(--qt-bg);
  color: var(--qt-text);
  font-family: var(--qt-mono);
}
```

- [ ] **Step 2: Verify existing pages are untouched**

```bash
npm run build && (PORT=3111 npx next start &) && sleep 6
curl -s http://localhost:3111/terminal | grep -c "term-wrap"   # expect >= 1
curl -s http://localhost:3111/ | grep -c "shell"               # expect >= 1
```

Expected: both non-zero, and nothing visually changed — `.term-app` is not yet applied to any element.

- [ ] **Step 3: Full gate**

```bash
npm test && npm run lint && npx tsc --noEmit
AUDIT_BASE_URL=http://localhost:3111 node scripts/responsive-audit.mjs
```

Expected: tests pass, lint clean, tsc silent, audit "All 48 viewport checks passed."

- [ ] **Step 4: Commit**

```bash
pkill -f "next start"; git checkout -- tsconfig.tsbuildinfo
git add app/globals.css
git commit -m "feat(css): add the QTERMINAL register alongside the boardroom one"
```

---

# Phase 2 — Data

### Task 2: Batch quotes, and stop discarding the day range

**Files:**
- Modify: `lib/providers/types.ts`
- Modify: `lib/providers/robinhood.ts:93-110` (the `getQuote` method)
- Modify: `lib/server/registry.ts`
- Test: `lib/providers/robinhood.test.ts` (add to the existing `lib/registry.test.ts` imports if a provider test file does not exist — create it)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `StockTokenQuote` gains `dailyHigh?: number` and `dailyLow?: number`.
  - `toQuote(raw: Record<string, unknown>, fallbackSymbol?: string): StockTokenQuote` — exported pure function.
  - `robinhoodProvider.getQuotes(): Promise<StockTokenQuote[]>` — all assets, one call.
  - `getQuotes(): Promise<StockTokenQuote[]>` from `lib/server/registry.ts`.

**Background (verified 2026-09-11):** `GET /rhj/prices` returns all 194 quotes in one call but sets `dailyHigh`, `dailyLow` and `dailyTradingVolume` to `0`. `GET /rhj/prices/NVDA` returns the same bid at the same `generatedAt` **with** real high/low/volume. Zero here means "not in this payload", not "the price was zero" — so zeros must normalise to `undefined` or the UI will render a real-looking `$0.00` day low.

- [ ] **Step 1: Write the failing test**

Create `lib/providers/robinhood.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toQuote } from "@/lib/providers/robinhood";

describe("toQuote", () => {
  it("keeps the day range the per-symbol endpoint returns", () => {
    const q = toQuote({
      tokenSymbol: "NVDA", bid: "218.02", ask: "218.07", currency: "USD",
      dailyHigh: "223.8", dailyLow: "217.2", dailyTradingVolume: "105705648",
      isTradingHalt: false, generatedAt: "2026-09-10T23:47:59.772833975Z",
    });
    expect(q.dailyHigh).toBe(223.8);
    expect(q.dailyLow).toBe(217.2);
    expect(q.dailyTradingVolume).toBe(105705648);
    expect(q.reference).toBeCloseTo(218.045, 3);
  });

  it("treats the batch endpoint's zeros as absent, not as a real zero", () => {
    // GET /rhj/prices returns real bid/ask but zeroes these three fields.
    // Rendering 0 as a day low would be inventing a price that never traded.
    const q = toQuote({
      tokenSymbol: "NVDA", bid: "218.46", ask: "218.49", currency: "USD",
      dailyHigh: 0, dailyLow: 0, dailyTradingVolume: 0, isTradingHalt: false,
    });
    expect(q.dailyHigh).toBeUndefined();
    expect(q.dailyLow).toBeUndefined();
    expect(q.dailyTradingVolume).toBeUndefined();
    expect(q.bid).toBe(218.46);
  });

  it("falls back to a single side when only one is quoted", () => {
    expect(toQuote({ tokenSymbol: "X", bid: "10" }).reference).toBe(10);
    expect(toQuote({ tokenSymbol: "X", ask: "12" }).reference).toBe(12);
  });

  it("uppercases the symbol and falls back when the payload omits it", () => {
    expect(toQuote({ tokenSymbol: "nvda" }).symbol).toBe("NVDA");
    expect(toQuote({}, "aapl").symbol).toBe("AAPL");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/providers/robinhood.test.ts`
Expected: FAIL — `toQuote` is not exported from `@/lib/providers/robinhood`.

- [ ] **Step 3: Add the fields to the type**

In `lib/providers/types.ts`, replace the `StockTokenQuote` type with:

```ts
export type StockTokenQuote = {
  symbol: string;
  bid?: number;
  ask?: number;
  /** Midpoint of bid/ask. A reference, never an executable price. */
  reference?: number;
  currency: string;
  dailyTradingVolume?: number;
  /** Session high/low. Present only from the per-symbol endpoint — the batch
   *  endpoint zeroes them, and a zero is normalised away rather than shown. */
  dailyHigh?: number;
  dailyLow?: number;
  tradingHalted: boolean;
  generatedAt?: string;
};
```

And add to the `StockTokenProvider` interface, after `getQuote`:

```ts
  /** Every quote the issuer has, in one call. Cheaper than N getQuote()s by
   *  two orders of magnitude, at the cost of the day-range fields. */
  getQuotes(): Promise<StockTokenQuote[]>;
```

- [ ] **Step 4: Implement in the provider**

In `lib/providers/robinhood.ts`, add above the provider object:

```ts
/** Zero is the batch endpoint's "field not included", not a traded value. */
const positive = (v: unknown) => {
  const n = num(v);
  return n !== undefined && n > 0 ? n : undefined;
};

export function toQuote(q: Record<string, unknown>, fallbackSymbol?: string): StockTokenQuote {
  const bid = num(q.bid);
  const ask = num(q.ask);
  return {
    symbol: String(q.tokenSymbol ?? fallbackSymbol ?? "").toUpperCase(),
    bid, ask,
    reference: bid !== undefined && ask !== undefined ? (bid + ask) / 2 : (bid ?? ask),
    currency: String(q.currency ?? "USD"),
    dailyTradingVolume: positive(q.dailyTradingVolume),
    dailyHigh: positive(q.dailyHigh),
    dailyLow: positive(q.dailyLow),
    tradingHalted: q.isTradingHalt === true,
    generatedAt: typeof q.generatedAt === "string" ? q.generatedAt : undefined,
  };
}
```

Replace the body of `getQuote` with:

```ts
  async getQuote(symbol) {
    const body = await get<{ quotes?: Array<Record<string, unknown>> }>(
      `/prices/${encodeURIComponent(symbol.toUpperCase())}`, QUOTE_TTL,
    );
    const q = body?.quotes?.[0];
    return q ? toQuote(q, symbol) : undefined;
  },

  async getQuotes() {
    const body = await get<{ quotes?: Array<Record<string, unknown>> }>("/prices", QUOTE_TTL);
    return (body?.quotes ?? []).map((q) => toQuote(q)).filter((q) => q.symbol);
  },
```

- [ ] **Step 5: Run the test**

Run: `npx vitest run lib/providers/robinhood.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Add the server passthrough**

In `lib/server/registry.ts`, add after `getQuote`:

```ts
/** Never throws — an issuer outage yields an empty board, not a crash. */
export async function getQuotes(): Promise<StockTokenQuote[]> {
  const results = await Promise.all(PROVIDERS.map((p) => p.getQuotes().catch(() => [])));
  return results.flat();
}
```

- [ ] **Step 7: Verify against the live endpoint**

```bash
npx tsc --noEmit && node --input-type=module -e "
const r = await fetch('https://api.robinhood.com/rhj/prices', {headers:{accept:'application/json'}});
const q = (await r.json()).quotes;
console.log('batch quotes:', q.length);
console.log('all dailyHigh zero:', q.every(x => Number(x.dailyHigh||0) === 0));
"
```

Expected: ~194 quotes, `all dailyHigh zero: true` — confirming the normalisation in Step 4 is load-bearing.

- [ ] **Step 8: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo
git add lib/providers lib/server/registry.ts
git commit -m "feat(providers): batch quotes, and keep the day range we were dropping"
```

---

### Task 3: Market cap for tile geometry

**Files:**
- Modify: `lib/nasdaq100.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Constituent.marketCapB?: number`; `NASDAQ_100_MARKET_CAP_AS_OF: string`.

- [ ] **Step 1: Extend the type and add the as-of constant**

In `lib/nasdaq100.ts`, replace the `Constituent` type and add the constant beneath `NASDAQ_100_AS_OF`:

```ts
export type Constituent = {
  symbol: string;
  company: string;
  sector: Sector;
  /**
   * Approximate market cap in USD billions. Used ONLY to size heatmap tiles —
   * never rendered as a figure, never used in a calculation a reader would act
   * on. Hand-maintained like the constituent list itself, which is why it
   * carries its own as-of date. Constituents without a value get the smallest
   * tile rather than a guessed one.
   */
  marketCapB?: number;
};

/** Refresh alongside NASDAQ_100_AS_OF. Disclosed in the heatmap's Sources. */
export const NASDAQ_100_MARKET_CAP_AS_OF = "2026-09-11";
```

- [ ] **Step 2: Populate values for the largest constituents**

Add `marketCapB` to the entries below. Leave every other constituent without the field — the smallest-tile fallback handles them, and a missing value is honest where a guessed one is not.

```
AAPL 3400   MSFT 3200   NVDA 3600   AVGO 1400   GOOGL 2200  GOOG 2200
AMZN 2300   META 1500   TSLA 800    COST 400    NFLX 380    AMD 260
ADBE 220    CSCO 240    QCOM 190    TXN 170     INTU 180    AMAT 150
MU 130      LRCX 120    KLAC 110    INTC 110    PLTR 180    APP 110
PANW 120    CRWD 90     MRVL 70     MSTR 60     SMCI 40     TTD 35
DDOG 45     WDAY 60     MDB 30      TEAM 50     ZS 30       FTNT 70
CTSH 40     LULU 35     MRNA 25     ON 30       AXON 60     CEG 70
TTWO 40
```

- [ ] **Step 3: Verify it compiles and nothing else broke**

Run: `npx tsc --noEmit && npm test`
Expected: silent, and all existing tests still pass — `marketCapB` is optional so `buildBoard()` is unaffected.

- [ ] **Step 4: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo
git add lib/nasdaq100.ts
git commit -m "feat(data): approximate market caps for heatmap tile geometry"
```

---

### Task 4: The terminal board

**Files:**
- Create: `lib/terminal/board.ts`
- Test: `lib/terminal/board.test.ts`

**Interfaces:**
- Consumes: `StockTokenAsset`, `StockTokenQuote` (Task 2), `Constituent.marketCapB` (Task 3), `DeskListing` from `lib/desk.ts`.
- Produces:
  - `INDEX_SYMBOL = "QQQ"`
  - `type TokenState = "tokenized" | "waiting"`
  - `type TerminalRow = { symbol, company, sector?, marketCapB?, state, asset?, quote?, listing? }`
  - `type TerminalBoard = { constituents: TerminalRow[]; index?: TerminalRow; tokenizedCount: number }`
  - `buildTerminalBoard(assets, quotes, listings): TerminalBoard`

- [ ] **Step 1: Write the failing test**

Create `lib/terminal/board.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { NASDAQ_100 } from "@/lib/nasdaq100";
import type { DeskListing } from "@/lib/desk";
import type { StockTokenAsset, StockTokenQuote } from "@/lib/providers/types";
import { buildTerminalBoard, INDEX_SYMBOL } from "@/lib/terminal/board";

const asset = (symbol: string, active = true): StockTokenAsset => ({
  id: `id-${symbol}`, symbol, tokenName: `${symbol} Token`, provider: "Robinhood",
  deployments: [{ contractAddress: "0x" + symbol.toLowerCase().padEnd(40, "0"), chainId: 4663, networkName: "Robinhood Chain" }],
  decimals: 18, currentMultiplier: "1", active,
});

const quote = (symbol: string): StockTokenQuote => ({
  symbol, bid: 10, ask: 11, reference: 10.5, currency: "USD", tradingHalted: false,
});

const listing = (ticker: string): DeskListing => ({
  ticker, priceUsd: 10.5, volume24h: 1000, liquidityUsd: 5000, kind: "constituent",
});

describe("buildTerminalBoard", () => {
  it("always returns every constituent, tokenised or not", () => {
    const b = buildTerminalBoard([asset("AAPL")], [], []);
    expect(b.constituents).toHaveLength(NASDAQ_100.length);
  });

  it("marks a row tokenized only when the registry has an active asset", () => {
    const b = buildTerminalBoard([asset("AAPL"), asset("MSFT", false)], [], []);
    const bySym = Object.fromEntries(b.constituents.map((r) => [r.symbol, r]));
    expect(bySym.AAPL.state).toBe("tokenized");
    expect(bySym.MSFT.state).toBe("waiting");   // inactive asset is not a token
    expect(bySym.NVDA.state).toBe("waiting");   // absent entirely
  });

  it("counts the tokenised constituents", () => {
    const b = buildTerminalBoard([asset("AAPL"), asset("MSFT")], [], []);
    expect(b.tokenizedCount).toBe(2);
  });

  it("puts QQQ in index, never among the constituents", () => {
    const b = buildTerminalBoard([asset(INDEX_SYMBOL)], [quote(INDEX_SYMBOL)], []);
    expect(b.index?.symbol).toBe(INDEX_SYMBOL);
    expect(b.constituents.some((r) => r.symbol === INDEX_SYMBOL)).toBe(false);
  });

  it("drops tokenised names that are not in the index", () => {
    // BA is tokenised by Robinhood but is not a Nasdaq-100 constituent.
    const b = buildTerminalBoard([asset("BA")], [quote("BA")], []);
    expect(b.constituents.some((r) => r.symbol === "BA")).toBe(false);
    expect(b.index?.symbol).not.toBe("BA");
  });

  it("never attaches a quote or listing to a row with no token", () => {
    // The issuer can return a price for a symbol we have no active asset for.
    // Showing it would imply a token exists when it does not.
    const b = buildTerminalBoard([], [quote("AAPL")], [listing("AAPL")]);
    const aapl = b.constituents.find((r) => r.symbol === "AAPL");
    expect(aapl?.state).toBe("waiting");
    expect(aapl?.quote).toBeUndefined();
    expect(aapl?.listing).toBeUndefined();
  });

  it("attaches quote and listing to a tokenised row", () => {
    const b = buildTerminalBoard([asset("AAPL")], [quote("AAPL")], [listing("AAPL")]);
    const aapl = b.constituents.find((r) => r.symbol === "AAPL");
    expect(aapl?.quote?.reference).toBe(10.5);
    expect(aapl?.listing?.priceUsd).toBe(10.5);
  });

  it("exposes no change or percent field anywhere — there is no honest source", () => {
    const b = buildTerminalBoard([asset("AAPL")], [quote("AAPL")], [listing("AAPL")]);
    for (const row of b.constituents) {
      for (const key of Object.keys(row)) {
        expect(key).not.toMatch(/change|percent|pct/i);
      }
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/terminal/board.test.ts`
Expected: FAIL — cannot resolve `@/lib/terminal/board`.

- [ ] **Step 3: Implement**

Create `lib/terminal/board.ts`:

```ts
/**
 * The terminal board — pure joining, no fetching.
 *
 * One row type feeds the sidebar, the heatmap and the detail view, so "what we
 * know about NVDA" is defined once. The board is always the full Nasdaq-100:
 * the names without a token are not a gap in the data, they are the subject.
 */

import type { DeskListing } from "@/lib/desk";
import { NASDAQ_100, type Constituent, type Sector } from "@/lib/nasdaq100";
import type { StockTokenAsset, StockTokenQuote } from "@/lib/providers/types";

/** The index itself. Pinned above the constituents, never one of them. */
export const INDEX_SYMBOL = "QQQ";
const INDEX_COMPANY = "Invesco QQQ Trust";

export type TokenState = "tokenized" | "waiting";

export type TerminalRow = {
  symbol: string;
  company: string;
  /** Absent on the index row, which belongs to no sector. */
  sector?: Sector;
  /** Tile geometry only. Approximate, as-of dated. Never shown as a figure. */
  marketCapB?: number;
  state: TokenState;
  asset?: StockTokenAsset;
  quote?: StockTokenQuote;
  listing?: DeskListing;
};

export type TerminalBoard = {
  constituents: TerminalRow[];
  index?: TerminalRow;
  tokenizedCount: number;
};

export function buildTerminalBoard(
  assets: StockTokenAsset[],
  quotes: StockTokenQuote[],
  listings: DeskListing[],
): TerminalBoard {
  const assetBySymbol = new Map<string, StockTokenAsset>();
  for (const a of assets) {
    if (a.active && !assetBySymbol.has(a.symbol)) assetBySymbol.set(a.symbol, a);
  }
  const quoteBySymbol = new Map(quotes.map((q) => [q.symbol, q]));
  const listingBySymbol = new Map(listings.map((l) => [l.ticker, l]));

  const build = (symbol: string, company: string, sector?: Sector, marketCapB?: number): TerminalRow => {
    const asset = assetBySymbol.get(symbol);
    return {
      symbol, company, sector, marketCapB,
      state: asset ? "tokenized" : "waiting",
      asset,
      // A price attached to a row with no token would imply a token exists.
      // The issuer quotes plenty of symbols we hold no active asset for.
      quote: asset ? quoteBySymbol.get(symbol) : undefined,
      listing: asset ? listingBySymbol.get(symbol) : undefined,
    };
  };

  const constituents = NASDAQ_100.map((c: Constituent) =>
    build(c.symbol, c.company, c.sector, c.marketCapB));

  const indexRow = build(INDEX_SYMBOL, INDEX_COMPANY);

  return {
    constituents,
    index: indexRow.state === "tokenized" ? indexRow : undefined,
    tokenizedCount: constituents.filter((r) => r.state === "tokenized").length,
  };
}

/** Sector order for the heatmap. Largest blocks first so the grid reads well. */
export const SECTOR_ORDER: Sector[] = [
  "Technology", "Communication", "Consumer", "Healthcare",
  "Industrials", "Utilities", "Energy",
];

export function groupBySector(rows: TerminalRow[]): Array<{ sector: Sector; rows: TerminalRow[] }> {
  return SECTOR_ORDER
    .map((sector) => ({ sector, rows: rows.filter((r) => r.sector === sector) }))
    .filter((g) => g.rows.length > 0);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/terminal/board.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo
git add lib/terminal
git commit -m "feat(terminal): one board type for sidebar, heatmap and detail"
```

---

### Task 5: Real candles, and the pool-drift fix

**Files:**
- Create: `lib/server/candles.ts`
- Test: `lib/server/candles.test.ts`
- Modify: `lib/server/desk.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `type Candle = { t: number; o: number; h: number; l: number; c: number; v: number }`
  - `type Timeframe = "minute" | "hour" | "day"`
  - `parseOhlcv(body: unknown): Candle[]` — pure.
  - `getCandles(poolAddress: string, timeframe: Timeframe, limit?: number): Promise<Candle[]>`
  - `poolsForToken(contractAddress: string): Promise<GtPool[]>` in `desk.ts`.

**Background (verified 2026-09-11):**
- `GET /api/v2/networks/robinhood/pools/{pool}/ohlcv/hour?limit=10` returns `data.attributes.ohlcv_list`, an array of `[unixSeconds, open, high, low, close, volume]`.
- `getDesk()` currently scans the first 5 pages of ranked pools, so a listing can drop out between syncs — two `/api/desk` calls minutes apart returned different sets. A tile flipping to "no market" is a market event that did not happen.
- The fix is `GET /networks/robinhood/tokens/{address}/pools`, which is deterministic. **Critical:** it returns pools where the token is on *either* side. For NVDA, **8 of 20** pools have NVDA as base; the other 12 (`AI / NVDA`, `MARIO / NVDA`, `SPY / NVDA`) report the *other* token's price — `AI / NVDA` shows `$0.22`. Filter on `relationships.base_token.data.id === "robinhood_<address>"` (lowercased) or you will publish a wildly wrong price.

- [ ] **Step 1: Write the failing test**

Create `lib/server/candles.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseOhlcv } from "@/lib/server/candles";

const body = (list: unknown) => ({ data: { attributes: { ohlcv_list: list } } });

describe("parseOhlcv", () => {
  it("reads GeckoTerminal's positional tuples", () => {
    const c = parseOhlcv(body([[1789081200, 1.00029, 1.00618, 0.99113, 1.00013, 21355855.14]]));
    expect(c).toHaveLength(1);
    // The API sends unix seconds; the chart wants milliseconds.
    expect(c[0]).toEqual({ t: 1789081200000, o: 1.00029, h: 1.00618, l: 0.99113, c: 1.00013, v: 21355855.14 });
  });

  it("returns oldest-first so a chart can draw left to right", () => {
    const c = parseOhlcv(body([
      [200, 2, 2, 2, 2, 0],
      [100, 1, 1, 1, 1, 0],
    ]));
    expect(c.map((x) => x.t)).toEqual([100000, 200000]);
  });

  it("drops malformed rows rather than emitting NaN", () => {
    const c = parseOhlcv(body([
      [100, 1, 1, 1, 1, 0],
      [200, "x", 1, 1, 1, 0],
      [300, 1, 1, 1, 1],
      null,
    ]));
    expect(c).toHaveLength(1);
  });

  it("never throws on a shape it does not recognise", () => {
    for (const junk of [undefined, null, {}, { data: {} }, body(null), body("nope"), "string"]) {
      expect(parseOhlcv(junk)).toEqual([]);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run lib/server/candles.test.ts`
Expected: FAIL — cannot resolve `@/lib/server/candles`.

- [ ] **Step 3: Implement candles**

Create `lib/server/candles.ts`:

```ts
import "server-only";

/**
 * Real OHLCV, from the only source that has any.
 *
 * The Robinhood issuer API has no history endpoint, so candles exist only for
 * tokens with a DEX pool. A symbol without one shows no chart — an empty frame
 * would imply we looked and found a flat market.
 */

const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";
/** GeckoTerminal's free tier is ~30 req/min. Detail routes only, never fanned out. */
const REVALIDATE = 300;

export type Candle = { t: number; o: number; h: number; l: number; c: number; v: number };
export type Timeframe = "minute" | "hour" | "day";

/** `[unixSeconds, open, high, low, close, volume]` — positional, not keyed. */
export function parseOhlcv(body: unknown): Candle[] {
  const list = (body as { data?: { attributes?: { ohlcv_list?: unknown } } })
    ?.data?.attributes?.ohlcv_list;
  if (!Array.isArray(list)) return [];

  const candles: Candle[] = [];
  for (const row of list) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const n = row.slice(0, 6).map(Number);
    if (n.some((v) => !Number.isFinite(v))) continue;
    candles.push({ t: n[0] * 1000, o: n[1], h: n[2], l: n[3], c: n[4], v: n[5] });
  }
  return candles.sort((a, b) => a.t - b.t);
}

/** Never throws — no candles degrades to no chart, it does not break the page. */
export async function getCandles(
  poolAddress: string, timeframe: Timeframe, limit = 100,
): Promise<Candle[]> {
  try {
    const response = await fetch(
      `${GT}/pools/${poolAddress}/ohlcv/${timeframe}?limit=${limit}`,
      { next: { revalidate: REVALIDATE }, headers: { accept: "application/json" } },
    );
    if (!response.ok) return [];
    return parseOhlcv(await response.json());
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run lib/server/candles.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Add the deterministic pool lookup**

First, `lib/server/desk.ts:10` declares `type GtPool = {` privately. The new function
returns it across a module boundary, so change that line to `export type GtPool = {`.
The existing shape already carries `relationships.base_token.data.id` and
`attributes.price_change_percentage.h24`; nothing else about it needs to change.

Then add after the existing `getPage` function:

```ts
/**
 * Every pool for one token, looked up by contract address.
 *
 * Ranked page-scanning is not stable: a listing can fall out of the top pages
 * between syncs, and a tile flipping from "has a market" to "no market" reads
 * as a de-listing that never happened. An address lookup always returns the
 * same answer for the same token.
 *
 * The endpoint returns pools where the token sits on EITHER side, so pools
 * whose base is some other token are discarded — for NVDA that is 12 of 20,
 * and one of them ("AI / NVDA") would otherwise report NVDA at $0.22.
 */
export async function poolsForToken(contractAddress: string): Promise<GtPool[]> {
  const address = contractAddress.toLowerCase();
  try {
    const response = await fetch(`${GT}/tokens/${address}/pools`, {
      next: { revalidate: REVALIDATE },
      headers: { accept: "application/json" },
    });
    if (!response.ok) return [];
    const body = (await response.json()) as { data?: GtPool[] };
    return (body.data ?? []).filter((pool) => {
      const base = pool.relationships?.base_token?.data?.id?.toLowerCase() ?? "";
      return base.endsWith(address);
    });
  } catch {
    return [];
  }
}

/** The pool a price should be read from: the deepest one. A thin secondary
 *  pool misreports the price of an otherwise liquid token. */
export function deepestPool(pools: GtPool[]): GtPool | undefined {
  return [...pools].sort(
    (a, b) => Number(b.attributes.reserve_in_usd ?? 0) - Number(a.attributes.reserve_in_usd ?? 0),
  )[0];
}
```

- [ ] **Step 6: Verify both against the live API**

```bash
npx tsc --noEmit && node --input-type=module -e "
const A='0xd0601ce157db5bdc3162bbac2a2c8af5320d9eec';
const p=await (await fetch(\`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/\${A}/pools\`)).json();
const base=x=>(x.relationships?.base_token?.data?.id||'').toLowerCase();
const mine=p.data.filter(x=>base(x).endsWith(A));
console.log('pools returned:', p.data.length, '| NVDA is base in:', mine.length);
const deep=[...mine].sort((a,b)=>Number(b.attributes.reserve_in_usd||0)-Number(a.attributes.reserve_in_usd||0))[0];
console.log('deepest:', deep.attributes.name, '@', deep.attributes.base_token_price_usd);
const o=await (await fetch(\`https://api.geckoterminal.com/api/v2/networks/robinhood/pools/\${deep.attributes.address}/ohlcv/hour?limit=5\`)).json();
console.log('candles:', o.data.attributes.ohlcv_list.length);
"
```

Expected: 20 pools returned, NVDA is base in 8, deepest is a `NVDA / …` pair priced near the issuer's bid (~$218, **not** $0.22), and 5 candles returned.

- [ ] **Step 7: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo
git add lib/server
git commit -m "feat(server): real OHLCV, and look pools up by address instead of rank"
```

---

# Phase 3 — The shell

### Task 6: Terminal chrome

**Files:**
- Create: `app/terminal/layout.tsx`
- Create: `components/terminal/shell/topbar.tsx`
- Create: `components/terminal/shell/utc-clock.tsx`
- Create: `components/terminal/shell/sidebar.tsx`
- Create: `components/terminal/shell/sidebar-search.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: `buildTerminalBoard`, `TerminalBoard`, `INDEX_SYMBOL` (Task 4); `getRegistry`, `getQuotes` (Task 2); `getDesk` (existing); the `--qt-*` tokens (Task 1).
- Produces: a `.term-app` shell wrapping every `/terminal/*` route. Later tasks render only the main pane.

**CSS port:** copy the prototype's `css/style.css` rules for `.app`, `.topbar*`, `.layout`, `.sidebar*`, `.row*`, `.tok-dot`, `.main`, `.back-btn`, `.section-title` (lines ~171-298) into `app/globals.css`, **each prefixed with `.term-app `** and with `var(--bg)` → `var(--qt-bg)` etc. throughout.

**Two renames are mandatory:**
1. `.kv` → `.qt-kv`. The repo already has a `.kv` and the two are structurally incompatible: the repo's is a grid *wrapper* with `> div` rows; the prototype's *is* a row. This is the only collision across 108 repo and 64 prototype classes.
2. `.row` → `.qt-row` (and `.row-left` → `.qt-row-left`, etc.). The repo uses `.row` inside `.acard` on the terminal pages.

- [ ] **Step 1: Build the UTC clock**

Create `components/terminal/shell/utc-clock.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * The one genuinely live thing on the terminal.
 *
 * The prototype ticked prices every 2.5s off a random walk. Real data
 * revalidates on a 30s-300s cache, so a ticking price would be a better
 * looking lie. A clock, though, really is live — so it is the only thing
 * that moves.
 *
 * Renders empty on the server: the time at build is not the time you are
 * reading it, and rendering one would be both a lie and a hydration mismatch.
 */
export function UtcClock() {
  const [now, setNow] = useState<string>("");

  useEffect(() => {
    const tick = () => {
      const d = new Date();
      const p = (n: number) => String(n).padStart(2, "0");
      setNow(`${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())} UTC`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return <span className="qt-topbar-clock" suppressHydrationWarning>{now || "--:--:-- UTC"}</span>;
}
```

- [ ] **Step 2: Build the topbar**

Create `components/terminal/shell/topbar.tsx`:

```tsx
import Link from "next/link";
import { UtcClock } from "@/components/terminal/shell/utc-clock";

export function Topbar({ online }: { online: boolean }) {
  return (
    <div className="qt-topbar">
      <div className="qt-topbar-left">
        <Link className="qt-topbar-logo" href="/">QTERMINAL</Link>
        <span className="qt-topbar-sub">NASDAQ-100 · TOKENIZED</span>
      </div>
      <div className="qt-topbar-right">
        <span className={online ? "qt-status" : "qt-status off"}>
          {online ? "DESK ONLINE" : "DESK OFFLINE"}
        </span>
        <UtcClock />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build the sidebar**

Create `components/terminal/shell/sidebar.tsx`:

```tsx
import Link from "next/link";
import type { TerminalBoard, TerminalRow } from "@/lib/terminal/board";
import { SidebarSearch } from "@/components/terminal/shell/sidebar-search";

function price(row: TerminalRow) {
  const p = row.quote?.reference;
  return p === undefined ? "—" : `$${p.toFixed(2)}`;
}

function Row({ row, active, pinned }: { row: TerminalRow; active: boolean; pinned?: boolean }) {
  const href = pinned ? "/terminal" : `/terminal/asset/${row.symbol}`;
  return (
    <Link
      className={`qt-row${pinned ? " pinned" : ""}${active ? " active" : ""}`}
      href={href}
      data-symbol={row.symbol}
      data-name={row.company.toUpperCase()}
    >
      <span className="qt-row-left">
        {/* Real, from the issuer registry — the prototype's version of this
            dot was a hand-set guess its own README flagged as a placeholder. */}
        <i className={`qt-tok-dot${row.state === "tokenized" ? " tokenized" : ""}`}
           aria-hidden="true" />
        <span className="qt-row-id">
          <span className="qt-row-ticker">{row.symbol}</span>
          <span className="qt-row-name">{row.company}</span>
        </span>
      </span>
      <span className="qt-row-right">
        <span className="qt-row-price">{price(row)}</span>
      </span>
    </Link>
  );
}

export function Sidebar({ board, current }: { board: TerminalBoard; current?: string }) {
  const rest = [...board.constituents].sort((a, b) => a.symbol.localeCompare(b.symbol));
  return (
    <aside className="qt-sidebar" id="qt-sidebar">
      <SidebarSearch />
      <div className="qt-sidebar-list" id="qt-sidebar-list">
        {board.index && <Row row={board.index} active={current === board.index.symbol} pinned />}
        <div className="qt-sidebar-divider">
          NASDAQ-100 · {board.tokenizedCount} OF {board.constituents.length} TOKENIZED
        </div>
        {rest.map((row) => (
          <Row key={row.symbol} row={row} active={current === row.symbol} />
        ))}
      </div>
    </aside>
  );
}
```

- [ ] **Step 4: Build the search filter**

Create `components/terminal/shell/sidebar-search.tsx`:

```tsx
"use client";

import { useState } from "react";

/**
 * Filters the server-rendered list in place rather than refetching. The whole
 * board is already in the DOM, so this is a show/hide over 100 nodes — far
 * cheaper than a round trip, and it keeps working if the network drops.
 */
export function SidebarSearch() {
  const [query, setQuery] = useState("");

  function filter(value: string) {
    setQuery(value);
    const needle = value.trim().toUpperCase();
    const list = document.getElementById("qt-sidebar-list");
    if (!list) return;
    for (const el of list.querySelectorAll<HTMLElement>(".qt-row")) {
      const symbol = el.dataset.symbol ?? "";
      const name = el.dataset.name ?? "";
      el.style.display = !needle || symbol.includes(needle) || name.includes(needle) ? "" : "none";
    }
  }

  return (
    <div className="qt-sidebar-search">
      <label className="sr-only" htmlFor="qt-search">Search ticker or name</label>
      <input
        id="qt-search"
        value={query}
        onChange={(e) => filter(e.target.value)}
        placeholder="SEARCH TICKER OR NAME"
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
}
```

- [ ] **Step 5: Build the layout**

Create `app/terminal/layout.tsx`:

```tsx
import type { ReactNode } from "react";
import { Sidebar } from "@/components/terminal/shell/sidebar";
import { Topbar } from "@/components/terminal/shell/topbar";
import { getDesk } from "@/lib/server/desk";
import { getQuotes, getRegistry } from "@/lib/server/registry";
import { buildTerminalBoard } from "@/lib/terminal/board";

export const revalidate = 300;

export default async function TerminalLayout({ children }: { children: ReactNode }) {
  const [reg, quotes, desk] = await Promise.all([getRegistry(), getQuotes(), getDesk()]);
  const board = buildTerminalBoard(reg.assets, quotes, desk.listings);

  return (
    <div className="term-app qt-app">
      <Topbar online={reg.ok} />
      <div className="qt-layout">
        <Sidebar board={board} />
        <main className="qt-main">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Port the CSS**

Append the prefixed, renamed rules described above to `app/globals.css`, plus:

```css
/* Below 820px the sidebar and the detail pane stop being a split and become
   two full-screen views, exactly as the prototype does it. */
@media (max-width: 820px) {
  .term-app .qt-layout { display: block; }
  .term-app .qt-sidebar { width: 100%; border-right: none; }
  .term-app .qt-main { display: none; }
  .term-app[data-view="detail"] .qt-sidebar { display: none; }
  .term-app[data-view="detail"] .qt-main { display: block; }
}
```

- [ ] **Step 7: Verify the shell renders with real data**

```bash
npm run build && (PORT=3111 npx next start &) && sleep 6
curl -s http://localhost:3111/terminal | grep -o 'NASDAQ-100 · [0-9]* OF [0-9]* TOKENIZED'
curl -s http://localhost:3111/terminal | grep -c 'qt-tok-dot tokenized'
```

Expected: the divider reads roughly `NASDAQ-100 · 41 OF 100 TOKENIZED`, and the tokenized-dot count matches that first number. If the count is 0, the registry call failed — check `reg.ok`, do not paper over it.

- [ ] **Step 8: Commit**

```bash
pkill -f "next start"; git checkout -- tsconfig.tsbuildinfo
git add app/terminal/layout.tsx components/terminal/shell app/globals.css
git commit -m "feat(terminal): one shell for every terminal route"
```

---

### Task 7: Reparent the existing pages

**Files:**
- Modify: `app/terminal/the-100/page.tsx`
- Modify: `app/terminal/verify/page.tsx`
- Modify: `app/terminal/asset/[symbol]/page.tsx`

**Interfaces:**
- Consumes: the shell from Task 6.
- Produces: three routes that render inside the shell at unchanged URLs.

- [ ] **Step 1: Remove the per-page headers**

In each of the three files, delete the `<TerminalHeader ... />` element and its import — the shell now provides the chrome. Keep each page's `<Sources>` block, its `metadata` export, and every data call exactly as they are.

Replace each page's outer wrapper:

```tsx
// before
<div className="term"><div className="term-wrap">…</div></div>
// after
<div className="qt-pane">…</div>
```

- [ ] **Step 2: Verify every URL still works inside the shell**

```bash
npm run build && (PORT=3111 npx next start &) && sleep 6
for p in /terminal /terminal/the-100 /terminal/verify /terminal/asset/NVDA; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3111$p")
  shell=$(curl -s "http://localhost:3111$p" | grep -c 'qt-topbar-logo')
  echo "$p -> $code (shell present: $shell)"
done
```

Expected: all four `200` with `shell present: 1`.

- [ ] **Step 3: Confirm UTC timestamps survived**

```bash
curl -s http://localhost:3111/terminal/verify | grep -o '<time[^>]*>[^<]*</time>' | head -2
curl -s http://localhost:3111/terminal/asset/NVDA | grep -c "Sydney"
```

Expected: timestamps ending `UTC`; `Sydney` count `0`.

- [ ] **Step 4: Full gate and commit**

```bash
npm test && npm run lint && npx tsc --noEmit
AUDIT_BASE_URL=http://localhost:3111 node scripts/responsive-audit.mjs
pkill -f "next start"; git checkout -- tsconfig.tsbuildinfo
git add app/terminal
git commit -m "refactor(terminal): reparent the existing pages into the shell"
```

---

# Phase 4 — Views

### Task 8: The QQQ view and the heatmap

**Files:**
- Create: `components/terminal/heatmap.tsx`
- Create: `components/terminal/heatmap-tooltip.tsx`
- Modify: `app/terminal/page.tsx` (replace the body entirely)

**Interfaces:**
- Consumes: `TerminalBoard`, `groupBySector`, `TerminalRow` (Task 4); `NASDAQ_100_MARKET_CAP_AS_OF` (Task 3).
- Produces: `<Heatmap board={board} />`.

**The three tile dimensions — read this before writing any tile code:**

| dimension | driven by | status |
|---|---|---|
| **size** | `marketCapB` | approximate, as-of dated, geometry only |
| **border** | `state === "tokenized"` | **real**, from the issuer registry |
| **fill** | the day's % change | **OFF in V1 — there is no honest source** |

Tiles get a flat `var(--qt-panel-alt)` background. Do **not** port `heatColor()` from the prototype. Do **not** colour by day range as a substitute. Spec §3.3 and §11.

- [ ] **Step 1: Build the heatmap**

Create `components/terminal/heatmap.tsx`:

```tsx
import Link from "next/link";
import { NASDAQ_100_MARKET_CAP_AS_OF } from "@/lib/nasdaq100";
import { groupBySector, type TerminalBoard, type TerminalRow } from "@/lib/terminal/board";

/** Area roughly proportional to market cap, clamped so no tile disappears or
 *  dominates. Constituents with no cap value get the floor size. */
function dims(marketCapB?: number) {
  if (!marketCapB) return { width: 44, height: 32 };
  const scale = Math.sqrt(marketCapB);
  return {
    width: Math.round(Math.max(44, Math.min(140, scale * 6))),
    height: Math.round(Math.max(32, Math.min(100, scale * 4.2))),
  };
}

function Tile({ row }: { row: TerminalRow }) {
  const { width, height } = dims(row.marketCapB);
  const price = row.quote?.reference;
  return (
    <Link
      className={`qt-tile${row.state === "tokenized" ? " tokenized" : ""}`}
      href={`/terminal/asset/${row.symbol}`}
      style={{ width, height }}
      data-symbol={row.symbol}
      data-company={row.company}
      data-price={price === undefined ? "" : `$${price.toFixed(2)}`}
      data-state={row.state === "tokenized" ? "Tokenized" : "No token yet"}
      aria-label={`${row.symbol}, ${row.company}, ${row.state === "tokenized" ? "tokenized" : "not yet tokenized"}`}
    >
      <span className="qt-t-sym">{row.symbol}</span>
      {price !== undefined && <span className="qt-t-px">{price.toFixed(2)}</span>}
    </Link>
  );
}

export function Heatmap({ board }: { board: TerminalBoard }) {
  const groups = groupBySector(board.constituents);
  return (
    <section className="qt-heatmap-section">
      <div className="qt-heatmap-toolbar">
        <span className="qt-section-title">NASDAQ-100 · TOKENIZATION MAP</span>
        <span className="qt-legend">
          <i className="qt-tok-dot tokenized" aria-hidden="true" /> tokenized
          <i className="qt-tok-dot" aria-hidden="true" /> not yet
        </span>
      </div>
      <div className="qt-heatmap-box">
        {groups.map(({ sector, rows }) => (
          <div className="qt-sector-block" key={sector}>
            <div className="qt-sector-label">{sector.toUpperCase()} ({rows.length})</div>
            <div className="qt-sector-grid">
              {rows.map((row) => <Tile key={row.symbol} row={row} />)}
            </div>
          </div>
        ))}
      </div>
      <p className="qt-note">
        Border shows whether Robinhood has released a Stock Token for that company —
        {" "}{board.tokenizedCount} of {board.constituents.length} so far. Tile size is
        approximate market cap as of {NASDAQ_100_MARKET_CAP_AS_OF}, used for layout only.
        Tiles are not coloured by price change: the issuer API publishes no previous
        close, so no honest daily change exists to show.
      </p>
    </section>
  );
}
```

- [ ] **Step 2: Build the tooltip**

Create `components/terminal/heatmap-tooltip.tsx`:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

type Info = { symbol: string; company: string; price: string; state: string; x: number; y: number };

/** Supplementary only — every value here is also on the tile or its aria-label,
 *  so keyboard and screen-reader users lose nothing by never seeing it. */
export function HeatmapTooltip() {
  const [info, setInfo] = useState<Info | null>(null);
  const frame = useRef(0);

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const tile = (e.target as HTMLElement)?.closest<HTMLElement>(".qt-tile");
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => {
        setInfo(tile ? {
          symbol: tile.dataset.symbol ?? "",
          company: tile.dataset.company ?? "",
          price: tile.dataset.price ?? "",
          state: tile.dataset.state ?? "",
          x: e.clientX, y: e.clientY,
        } : null);
      });
    }
    document.addEventListener("mousemove", onMove);
    return () => { document.removeEventListener("mousemove", onMove); cancelAnimationFrame(frame.current); };
  }, []);

  if (!info) return null;
  return (
    <div className="qt-tooltip" role="presentation"
         style={{ left: Math.min(info.x + 14, window.innerWidth - 200), top: info.y + 14 }}>
      <strong>{info.symbol}</strong>
      <span>{info.company}</span>
      {info.price && <span>{info.price}</span>}
      <span className="qt-tt-state">{info.state}</span>
    </div>
  );
}
```

- [ ] **Step 3: Rewrite the QQQ view**

Replace the whole body of `app/terminal/page.tsx`:

```tsx
import type { Metadata } from "next";
import { Sources } from "@/components/terminal/chrome";
import { Heatmap } from "@/components/terminal/heatmap";
import { HeatmapTooltip } from "@/components/terminal/heatmap-tooltip";
import { UtcTime } from "@/components/terminal/utc-time";
import { NASDAQ_100_AS_OF, NASDAQ_100_MARKET_CAP_AS_OF } from "@/lib/nasdaq100";
import { getDesk } from "@/lib/server/desk";
import { getQuotes, getRegistry } from "@/lib/server/registry";
import { buildTerminalBoard } from "@/lib/terminal/board";

export const revalidate = 300;

export const metadata: Metadata = {
  title: "QQQ — QTERMINAL",
  description: "The Nasdaq-100 as Robinhood Stock Tokens: which companies are onchain, and which are not yet.",
};

export default async function QqqView() {
  const [reg, quotes, desk] = await Promise.all([getRegistry(), getQuotes(), getDesk()]);
  const board = buildTerminalBoard(reg.assets, quotes, desk.listings);
  const index = board.index;

  return (
    <div className="qt-pane">
      <div className="qt-headline">
        <h1>QQQ <small>Invesco QQQ Trust</small></h1>
        {index?.quote?.reference !== undefined && (
          <span className="qt-headline-px">${index.quote.reference.toFixed(2)}</span>
        )}
      </div>
      <div className="qt-kv-block">
        <div className="qt-kv"><span className="k">Bid</span><span className="v">{index?.quote?.bid?.toFixed(2) ?? "—"}</span></div>
        <div className="qt-kv"><span className="k">Ask</span><span className="v">{index?.quote?.ask?.toFixed(2) ?? "—"}</span></div>
        <div className="qt-kv"><span className="k">Tokenized constituents</span><span className="v">{board.tokenizedCount} / {board.constituents.length}</span></div>
        <div className="qt-kv"><span className="k">Quote generated</span><span className="v"><UtcTime iso={index?.quote?.generatedAt} /></span></div>
      </div>

      <Heatmap board={board} />
      <HeatmapTooltip />

      <Sources
        fetchedAt={reg.fetchedAt}
        lines={[
          "Stock Token registry, quotes and contracts: Robinhood Stock Token API (issuer).",
          `Nasdaq-100 membership: Nasdaq constituent list, as of ${NASDAQ_100_AS_OF}.`,
          `Tile size: approximate market cap as of ${NASDAQ_100_MARKET_CAP_AS_OF}, layout only — never a quoted figure.`,
          "No daily change is shown: the issuer publishes no previous close, and none is inferred.",
        ]}
      />
    </div>
  );
}
```

- [ ] **Step 4: Port the heatmap CSS**

Port `.heatmap-section`, `.heatmap-toolbar`, `.heatmap-box`, `.sector-block`, `.sector-label`, `.sector-grid`, `.tile`, `.tile.tokenized`, `.t-sym`, `.tile-tooltip` from the prototype (lines ~299-345 and the tooltip block) into `app/globals.css`, prefixed `.term-app .qt-…`. Give `.qt-tile` a flat `background: var(--qt-panel-alt)` — no gradient, no heat scale.

- [ ] **Step 5: Verify no fabricated colour crept in**

```bash
npm run build && (PORT=3111 npx next start &) && sleep 6
curl -s http://localhost:3111/terminal | grep -c 'qt-tile'            # expect 100
curl -s http://localhost:3111/terminal | grep -c 'qt-tile tokenized'  # expect ~41
curl -s http://localhost:3111/terminal | grep -Eic 'hsl\(140|hsl\(4,' # expect 0
grep -ric "heatColor\|mulberry\|changePercent" components/ lib/ app/  # expect 0
```

Expected: 100 tiles, ~41 tokenized, **zero** heat-scale colours, **zero** references to the prototype's generator.

- [ ] **Step 6: Commit**

```bash
pkill -f "next start"; git checkout -- tsconfig.tsbuildinfo
git add components/terminal app/terminal/page.tsx app/globals.css
git commit -m "feat(terminal): the tokenization map, coloured only by what is true"
```

---

### Task 9: Asset detail — four real cards and a real chart

**Files:**
- Create: `components/terminal/candle-chart.tsx`
- Modify: `app/terminal/asset/[symbol]/page.tsx`

**Interfaces:**
- Consumes: `getCandles`, `poolsForToken`, `deepestPool` (Task 5); `getQuote` (Task 2); `getCorporateActions` (existing).
- Produces: `<CandleChart candles={…} symbol={…} />`.

**Card inventory — each replaces one of the prototype's fabricated ones:**

| Card | Source | Shown when |
|---|---|---|
| Issuer quote | `getQuote(symbol)` — bid, ask, mid, day high/low, volume, halt, generatedAt | token exists |
| Contract & deployments | registry asset | token exists |
| Corporate actions | `getCorporateActions()` filtered to symbol | any exist |
| Onchain market | deepest pool — price, 24h volume, liquidity, 24h change | a pool exists |
| Chart | `getCandles(pool, "hour", 168)` | a pool exists |

The onchain 24h change **is** real and may be shown here — but it is the *token's* onchain move, not the underlying equity's. Label it exactly `24h (onchain)`. Never reuse it as a heatmap fill.

- [ ] **Step 1: Build the chart**

Create `components/terminal/candle-chart.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";
import type { Candle } from "@/lib/server/candles";

/**
 * A line of real closes. Not candlesticks: at one hour per bar across a week
 * the bodies are narrower than their own borders, so a line reads better and
 * claims less precision than it has.
 */
export function CandleChart({ candles, symbol }: { candles: Candle[]; symbol: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || candles.length < 2) return;

    function draw() {
      const parent = canvas!.parentElement;
      if (!parent) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = parent.clientWidth;
      const h = 220;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`;
      canvas!.style.height = `${h}px`;

      const ctx = canvas!.getContext("2d");
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, w, h);

      const closes = candles.map((c) => c.c);
      const min = Math.min(...closes);
      const max = Math.max(...closes);
      const span = max - min || 1;
      const pad = 8;
      const x = (i: number) => (i / (candles.length - 1)) * (w - pad * 2) + pad;
      const y = (v: number) => h - pad - ((v - min) / span) * (h - pad * 2);

      ctx.strokeStyle = "#262626";
      ctx.lineWidth = 1;
      for (let g = 0; g <= 4; g += 1) {
        const gy = pad + (g / 4) * (h - pad * 2);
        ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(w - pad, gy); ctx.stroke();
      }

      ctx.strokeStyle = closes[closes.length - 1] >= closes[0] ? "#3dcc7a" : "#e05a4f";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      candles.forEach((c, i) => (i ? ctx.lineTo(x(i), y(c.c)) : ctx.moveTo(x(i), y(c.c))));
      ctx.stroke();
    }

    draw();
    window.addEventListener("resize", draw);
    return () => window.removeEventListener("resize", draw);
  }, [candles]);

  if (candles.length < 2) return null;

  return (
    <div className="qt-chart">
      <canvas ref={ref} role="img"
              aria-label={`${symbol} onchain price, last ${candles.length} hours`} />
    </div>
  );
}
```

- [ ] **Step 2: Wire the detail page**

Add these imports to `app/terminal/asset/[symbol]/page.tsx`:

```tsx
import { CandleChart } from "@/components/terminal/candle-chart";
import { formatUsd } from "@/lib/desk";
import { deepestPool, poolsForToken } from "@/lib/server/desk";
import { getCandles } from "@/lib/server/candles";
```

Then, after the existing registry and quote calls, add:

```tsx
  const contract = asset?.deployments[0]?.contractAddress;
  const pools = contract ? await poolsForToken(contract) : [];
  const pool = deepestPool(pools);
  const candles = pool?.attributes.address
    ? await getCandles(pool.attributes.address, "hour", 168)
    : [];
```

Add the day-range row to the existing issuer-quote `kv` block:

```tsx
<div><span className="k">Day range</span><span className="v">
  {quote?.dailyLow !== undefined && quote?.dailyHigh !== undefined
    ? `$${quote.dailyLow.toFixed(2)} – $${quote.dailyHigh.toFixed(2)}`
    : "—"}
</span></div>
```

Add the onchain card, rendered only when a pool exists:

```tsx
{pool && (
  <section className="panel">
    <h3>Onchain market</h3>
    <div className="kv">
      <div><span className="k">Pool price</span><span className="v">${Number(pool.attributes.base_token_price_usd ?? 0).toFixed(2)}</span></div>
      <div><span className="k">24h (onchain)</span><span className="v">{pool.attributes.price_change_percentage?.h24 ?? "—"}%</span></div>
      <div><span className="k">24h volume</span><span className="v">{formatUsd(Number(pool.attributes.volume_usd?.h24 ?? 0))}</span></div>
      <div><span className="k">Liquidity</span><span className="v">{formatUsd(Number(pool.attributes.reserve_in_usd ?? 0))}</span></div>
      <div><span className="k">Pair</span><span className="v">{pool.attributes.name ?? "—"}</span></div>
    </div>
    <CandleChart candles={candles} symbol={s} />
    <p className="term-sub" style={{ fontSize: "var(--t-micro)", marginTop: 12 }}>
      This is the token&rsquo;s own onchain market on Robinhood Chain, not the underlying
      equity. The 24h move above is the token&rsquo;s, and the two can diverge.
    </p>
  </section>
)}
```

Delete any remaining fabricated card markup. Add to the `Sources` lines: `"Onchain market and candles: GeckoTerminal, Robinhood Chain pools."`

- [ ] **Step 3: Verify against a tokenised name and a non-tokenised one**

```bash
npm run build && (PORT=3111 npx next start &) && sleep 6
echo "--- NVDA (tokenised, pooled) ---"
curl -s http://localhost:3111/terminal/asset/NVDA | grep -o 'Day range</span><span class="v">[^<]*'
curl -s http://localhost:3111/terminal/asset/NVDA | grep -c 'qt-chart'
echo "--- PEP (in the index, no token) ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3111/terminal/asset/PEP
curl -s http://localhost:3111/terminal/asset/PEP | grep -c 'Onchain market'
```

Expected: NVDA shows a real day range near $218 and one chart; PEP returns `200` with **zero** onchain cards and no empty chart frame.

- [ ] **Step 4: Full gate and commit**

```bash
npm test && npm run lint && npx tsc --noEmit
AUDIT_BASE_URL=http://localhost:3111 node scripts/responsive-audit.mjs
pkill -f "next start"; git checkout -- tsconfig.tsbuildinfo
git add components/terminal app/terminal/asset
git commit -m "feat(terminal): asset detail on real quotes, contracts, actions and candles"
```

---

# Phase 5 — The front door

### Task 10: Starfield landing

**Files:**
- Create: `components/landing/starfield.tsx`
- Create: `components/landing/qoka-arrow.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: nothing.
- Produces: `<Starfield />`, `<QokaArrow targetId="qoka" />`.

**Port from** `index.html` lines 44-119 (the canvas loop). Three changes are mandatory, because this is now the first thing a phone loads rather than a demo page:

- [ ] **Step 1: Build the starfield**

Create `components/landing/starfield.tsx`:

```tsx
"use client";

import { useEffect, useRef } from "react";

const STAR_COUNT = 140;

/**
 * Ported from the prototype with three changes it needs to survive being the
 * site's front door on a phone: DPR is capped at 2, the loop stops when the
 * tab is hidden or the canvas scrolls away, and reduced-motion gets a static
 * field instead of an animated one.
 */
export function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, raf = 0, t = 0, running = true;

    function resize() {
      w = window.innerWidth; h = window.innerHeight;
      canvas!.width = w * dpr; canvas!.height = h * dpr;
      canvas!.style.width = `${w}px`; canvas!.style.height = `${h}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const stars = Array.from({ length: STAR_COUNT }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      size: Math.random() < 0.15 ? 2 : 1,
      phase: Math.random() * Math.PI * 2,
      speed: 0.5 + Math.random() * 1.2,
    }));

    type Shot = { x: number; y: number; len: number; speed: number; angle: number; life: number };
    let shots: Shot[] = [];

    function paint() {
      ctx!.fillStyle = "#000";
      ctx!.fillRect(0, 0, w, h);
      for (const s of stars) {
        const twinkle = still ? 0.7 : 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.phase));
        ctx!.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
        ctx!.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
      }
      for (const st of shots) {
        const tailX = st.x - Math.cos(st.angle) * st.len;
        const tailY = st.y - Math.sin(st.angle) * st.len;
        const grad = ctx!.createLinearGradient(st.x, st.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,178,56,${st.life})`);
        grad.addColorStop(1, "rgba(255,178,56,0)");
        ctx!.strokeStyle = grad; ctx!.lineWidth = 2;
        ctx!.beginPath(); ctx!.moveTo(st.x, st.y); ctx!.lineTo(tailX, tailY); ctx!.stroke();
      }
    }

    function frame() {
      if (!running) return;
      t += 0.02;
      for (const st of shots) {
        st.x += Math.cos(st.angle) * st.speed;
        st.y += Math.sin(st.angle) * st.speed;
        st.life -= 0.02;
      }
      shots = shots.filter((s) => s.life > 0 && s.y < h + 50);
      paint();
      raf = requestAnimationFrame(frame);
    }

    let spawner = 0;
    if (still) {
      paint();
    } else {
      frame();
      spawner = window.setInterval(() => {
        if (running && Math.random() < 0.6) {
          shots.push({
            x: Math.random() * w * 0.7, y: Math.random() * h * 0.4,
            len: 40 + Math.random() * 60, speed: 6 + Math.random() * 5,
            angle: Math.PI / 5, life: 1,
          });
        }
      }, 1800);
    }

    // Burning a phone's battery animating a canvas nobody can see is the kind
    // of thing that makes a landing page feel cheap.
    const observer = new IntersectionObserver(([entry]) => {
      running = entry.isIntersecting && !document.hidden;
      if (running && !still) { cancelAnimationFrame(raf); frame(); }
    });
    observer.observe(canvas);

    function onVisibility() {
      running = !document.hidden;
      if (running && !still) { cancelAnimationFrame(raf); frame(); }
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("resize", resize);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      if (spawner) clearInterval(spawner);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas className="qt-starfield" ref={ref} aria-hidden="true" />;
}
```

- [ ] **Step 2: Build the arrow**

Create `components/landing/qoka-arrow.tsx`:

```tsx
"use client";

/** A real button, not a decorated div — it is the only route to the narrative
 *  for anyone navigating by keyboard. */
export function QokaArrow({ targetId }: { targetId: string }) {
  return (
    <button
      type="button"
      className="qt-qoka-arrow"
      onClick={() => {
        const el = document.getElementById(targetId);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      }}
    >
      <span className="qt-arrow-label">$QOKA</span>
      <span className="qt-arrow-glyph" aria-hidden="true">▾</span>
      <span className="sr-only">Scroll to what $QOKA is</span>
    </button>
  );
}
```

- [ ] **Step 3: Port the landing CSS**

Port `.landing`, `.landing-content`, `.qt-title`, `.enter-btn`, `.scroll-cue` from the prototype (lines 61-170) into `app/globals.css` as `.qt-landing`, `.qt-landing-content`, `.qt-title`, `.qt-enter-btn`, `.qt-qoka-arrow`. Add:

```css
.qt-starfield { position: fixed; inset: 0; width: 100%; height: 100%; z-index: 0; }
.qt-landing { position: relative; min-height: 100svh; display: grid; place-items: center; }
.qt-landing-content, .qt-qoka-arrow { position: relative; z-index: 1; }
.qt-title { font-size: clamp(2.2rem, 1.2rem + 5vw, 5rem); letter-spacing: 0.12em; color: var(--qt-amber); }
@media (prefers-reduced-motion: reduce) {
  .qt-qoka-arrow .qt-arrow-glyph { animation: none; }
}
```

- [ ] **Step 4: Commit**

```bash
git checkout -- tsconfig.tsbuildinfo
git add components/landing app/globals.css
git commit -m "feat(landing): starfield that stops when nobody is looking at it"
```

---

### Task 11: The new front page

**Files:**
- Create: `components/qoka/narrative.tsx`
- Modify: `app/page.tsx`
- Modify: `scripts/responsive-audit.mjs`

**Interfaces:**
- Consumes: `<Starfield />`, `<QokaArrow />` (Task 10).
- Produces: the site's front door.

- [ ] **Step 1: Extract the narrative**

Move everything currently inside `<main>` in `app/page.tsx` — the film strip, hero, creed, mandate, floor and contract sections — into `components/qoka/narrative.tsx` as `export async function Narrative()`, wrapped in `<section id="qoka" className="shell">`. Keep `BrandTape`, `Header`, `MarketTape` and `DeskPreview` exactly as they are; they belong to the boardroom register and are unchanged.

- [ ] **Step 2: Rewrite the front page**

Replace `app/page.tsx` with:

```tsx
import Link from "next/link";
import { QokaArrow } from "@/components/landing/qoka-arrow";
import { Starfield } from "@/components/landing/starfield";
import { Narrative } from "@/components/qoka/narrative";

export const revalidate = 300;

export default function HomePage() {
  return (
    <>
      {/* The instrument first. The story is one scroll below it, in the same
          document, so a crawler still reads every word of the narrative. */}
      <div className="term-app qt-landing-wrap">
        <Starfield />
        <div className="qt-landing">
          <div className="qt-landing-content">
            <h1 className="qt-title">QTERMINAL</h1>
            <p className="qt-strap">NASDAQ-100 · TOKENIZED · ROBINHOOD CHAIN</p>
            <Link className="qt-enter-btn" href="/terminal">PRESS TO ENTER</Link>
          </div>
          <QokaArrow targetId="qoka" />
        </div>
      </div>
      <Narrative />
    </>
  );
}
```

- [ ] **Step 3: Add the new routes to the audit**

In `scripts/responsive-audit.mjs`, the `ROUTES` array already covers `/` and the terminal pages. Confirm `["asset", "/terminal/asset/NVDA"]` is present and add `["asset-untokenized", "/terminal/asset/PEP"]` so the no-chart path is checked at every width too.

- [ ] **Step 4: Verify the whole front door**

```bash
npm run build && (PORT=3111 npx next start &) && sleep 6
curl -s http://localhost:3111/ | grep -c 'QTERMINAL'        # expect >= 1
curl -s http://localhost:3111/ | grep -c 'id="qoka"'        # expect 1
curl -s http://localhost:3111/ | grep -c 'PRESS TO ENTER'   # expect 1
# the narrative must be in the HTML, not behind JS, or SEO is lost
curl -s http://localhost:3111/ | grep -c 'Directing the'    # expect >= 1
```

Expected: all non-zero. If `Directing the` is 0, the narrative is client-only — fix before proceeding.

- [ ] **Step 5: Final gate across every route and width**

```bash
npm test && npm run lint && npx tsc --noEmit
AUDIT_BASE_URL=http://localhost:3111 node scripts/responsive-audit.mjs
grep -ric "mulberry\|heatColor\|getFundamentals\|allorigins" app/ lib/ components/   # expect 0
```

Expected: all green, and **zero** traces of the prototype's data layer anywhere in the tree.

- [ ] **Step 6: Commit and ship**

```bash
pkill -f "next start"; git checkout -- tsconfig.tsbuildinfo
git add app/page.tsx components/qoka scripts/responsive-audit.mjs
git commit -m "feat(site): QTERMINAL is the front door, \$QOKA is one scroll below"
git push origin main   # auto-deploys to production
```

- [ ] **Step 7: Verify production**

```bash
sleep 90
curl -s https://quokka-eta.vercel.app/ | grep -c 'PRESS TO ENTER'
curl -s https://quokka-eta.vercel.app/terminal | grep -o 'NASDAQ-100 · [0-9]* OF [0-9]* TOKENIZED'
for p in / /terminal /terminal/the-100 /terminal/verify /terminal/asset/NVDA; do
  echo "$p $(curl -s -o /dev/null -w '%{http_code}' https://quokka-eta.vercel.app$p)"
done
```

Expected: landing live, the tokenized count matches local, all five routes `200`.

---

## Self-Review Notes

**Spec coverage.** §1 core finding → Global Constraints + Task 8 Step 5 grep. §2 decisions 1-9 → Tasks 1-11 throughout. §3.2 batch/per-symbol split → Task 2. §3.3 no % change → Global Constraints + Task 4 test + Task 8. §3.4 pool drift → Task 5 Step 5. §3.5 market cap → Task 3. §4 routes and row type → Tasks 4, 6, 7. §5 card swap → Task 9. §6 honest liveness → Task 6 Step 1. §7 visual → Tasks 1, 6, 8, 10. §8 NFRs → Tasks 6 (820px), 10 (motion, DPR), 11 (audit). §9 testing → Tasks 2, 4, 5. §10 build order → phase structure.

**Deliberately deferred within this plan:** the `.qt-*` CSS ports are described by prototype line ranges rather than transcribed in full — the source is a file on disk, and copying 400 lines of CSS into a plan invites transcription errors rather than preventing them. Every rename and every value change is named explicitly.

**Known gap:** `Sector` in `lib/nasdaq100.ts` has seven values and `SECTOR_ORDER` in Task 4 lists all seven. If a constituent carries a sector outside that list, `groupBySector` silently drops it. Task 4's first test catches a count mismatch at the board level, but add a `SECTOR_ORDER` completeness assertion if the sector list ever changes.
