/* ============================================================
   QTERMINAL — market.js
   Two layers:
   1. MOCK ENGINE (bottom half of the old file) — deterministic,
      instant, never fails. Used as the fallback whenever a real
      fetch fails, and as the "cosmetic jitter" between real syncs
      so the UI always feels alive even mid-request.
   2. LIVE LAYER (top half, new) — real data from Yahoo Finance's
      unofficial endpoints, reached through a public CORS proxy
      since browsers can't call Yahoo cross-origin directly and
      Yahoo sends no CORS headers of its own.

   HONEST LIMITS OF THE LIVE LAYER:
   - Public CORS proxies (api.allorigins.win here) rate-limit and
     occasionally go down. Every live call has a fallback, so a
     bad proxy day degrades to mock data rather than breaking the
     page — but it IS a real dependency on a third party you don't
     control. A self-hosted proxy (Cloudflare Worker, ~20 lines)
     removes this risk entirely and is the right move before this
     is depended on for anything real.
   - Fetching all ~90 constituents individually, continuously,
     would get the shared proxy rate-limited fast. So: the
     currently-viewed ticker gets fully live data (quote, chart,
     fundamentals, news) refreshed on its own short interval; the
     rest of the universe (sidebar + heatmap) gets a slower
     staggered background sync every 90s that seeds real
     price/market-cap into the mock engine, which then keeps
     drifting realistically between syncs. That's why sidebar
     numbers look "alive" constantly but only update to a truly
     fresh real number roughly every 90s.
   - "Is this ticker tokenized by Robinhood" is NOT made live here.
     I looked for a real public source (Robinhood publishes no API
     for it, and the one third-party tracker I found renders its
     table via JS with nothing to fetch server-side) and didn't
     find one that's actually fetchable. That flag stays as the
     manually-maintained data in data.js — treat it like the
     NASDAQ-100 constituent list itself: periodically re-verified
     by hand, not streamed.
   ============================================================ */

const USE_LIVE_FETCH = true;
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

function yahooProxy(url) {
  return `${CORS_PROXY}${encodeURIComponent(url)}`;
}

async function fetchJson(url, timeoutMs = 4500) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

// ---- tiny TTL cache so repeated renders don't refetch instantly ----
const _cache = {};
async function withCache(key, ttlMs, fetcher) {
  const entry = _cache[key];
  const now = Date.now();
  if (entry && now - entry.ts < ttlMs) return entry.data;
  const data = await fetcher();
  if (data != null) {
    _cache[key] = { data, ts: now };
    return data;
  }
  return entry ? entry.data : null; // stale-but-something beats nothing
}

/* ---------------- Yahoo: chart (quote + history in one call) ---------------- */
const RANGE_TO_YF = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1wk" },
  "1Y": { range: "1y", interval: "1wk" }
};

async function fetchYahooChart(ticker, range) {
  const cfg = RANGE_TO_YF[range] || RANGE_TO_YF["1D"];
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?range=${cfg.range}&interval=${cfg.interval}`;
  const json = await fetchJson(yahooProxy(url));
  const result = json?.chart?.result?.[0];
  const q = result?.indicators?.quote?.[0];
  if (!result || !result.timestamp || !q) return null;

  const candles = [];
  for (let i = 0; i < result.timestamp.length; i++) {
    if (q.close[i] == null) continue;
    candles.push({
      t: result.timestamp[i] * 1000,
      open: q.open[i] ?? q.close[i],
      high: q.high[i] ?? q.close[i],
      low: q.low[i] ?? q.close[i],
      close: q.close[i],
      volume: q.volume[i] ?? 0
    });
  }
  if (candles.length === 0) return null;
  return { candles, meta: result.meta };
}

/* ---------------- Yahoo: quoteSummary (fundamentals) ---------------- */
async function fetchYahooQuoteSummary(ticker) {
  const modules = "price,summaryDetail,defaultKeyStatistics,calendarEvents,recommendationTrend,financialData,earningsHistory,incomeStatementHistoryQuarterly";
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=${modules}`;
  const json = await fetchJson(yahooProxy(url));
  return json?.quoteSummary?.result?.[0] || null;
}

async function fetchYahooPriceOnly(ticker) {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=price`;
  const json = await fetchJson(yahooProxy(url));
  return json?.quoteSummary?.result?.[0]?.price || null;
}

async function fetchYahooNews(ticker) {
  const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${ticker}&newsCount=5&quotesCount=0`;
  const json = await fetchJson(yahooProxy(url));
  return json?.news || null;
}

/* ---------------- public async API: quote / history / fundamentals ---------------- */
async function getHistoryAsync(ticker, range) {
  ticker = ticker.toUpperCase();
  if (USE_LIVE_FETCH) {
    const ttl = range === "1D" ? 20000 : range === "5D" ? 60000 : 300000;
    const live = await withCache(`chart_${ticker}_${range}`, ttl, () => fetchYahooChart(ticker, range));
    if (live && live.candles.length > 1) {
      // real price seeds the mock engine so the header/sidebar agree with the chart
      seedLiveState(ticker, live.meta);
      return { candles: live.candles, meta: live.meta, live: true };
    }
  }
  return { candles: getHistory(ticker, range), live: false };
}

async function getQuoteAsync(ticker) {
  ticker = ticker.toUpperCase();
  if (USE_LIVE_FETCH) {
    const live = await withCache(`chart_${ticker}_1D`, 20000, () => fetchYahooChart(ticker, "1D"));
    if (live?.meta) {
      seedLiveState(ticker, live.meta);
      return { ...getQuote(ticker), live: true };
    }
  }
  return { ...getQuote(ticker), live: false };
}

async function getFundamentalsAsync(ticker) {
  ticker = ticker.toUpperCase();
  const mock = getFundamentals(ticker);
  if (!USE_LIVE_FETCH) return { ...mock, live: false };

  const result = await withCache(`qsum_${ticker}`, 300000, () => fetchYahooQuoteSummary(ticker));
  if (!result) return { ...mock, live: false };

  try {
    const price = result.price || {};
    const summary = result.summaryDetail || {};
    const stats = result.defaultKeyStatistics || {};
    const cal = result.calendarEvents || {};
    const rec = result.recommendationTrend?.trend?.[0] || {};
    const fin = result.financialData || {};

    const total = (rec.strongBuy ?? 0) + (rec.buy ?? 0) + (rec.hold ?? 0) + (rec.sell ?? 0) + (rec.strongSell ?? 0);
    const hasRec = total > 0;

    const newsRaw = await withCache(`news_${ticker}`, 300000, () => fetchYahooNews(ticker));
    const news = (newsRaw || []).slice(0, 4).map(n => ({
      headline: n.title,
      url: n.link,
      publisher: n.publisher,
      time: n.providerPublishTime ? new Date(n.providerPublishTime * 1000) : new Date()
    }));

    const exDivRaw = summary.exDividendDate?.raw;
    const dividendYield = summary.dividendYield?.raw != null ? summary.dividendYield.raw * 100 : null;
    const earningsRaw = cal.earnings?.earningsDate?.[0]?.raw;

    return {
      ticker,
      live: true,
      marketCap: price.marketCap?.raw ?? null,
      earnings: {
        date: earningsRaw ? new Date(earningsRaw * 1000) : mock.earnings.date,
        epsEstimate: stats.forwardEps?.raw ?? mock.earnings.epsEstimate,
        history: mock.earnings.history // per-quarter beat/miss needs a separate module — left simulated
      },
      dividend: dividendYield != null ? {
        yieldPct: dividendYield,
        exDivDate: exDivRaw ? new Date(exDivRaw * 1000) : new Date(),
        perShare: summary.dividendRate?.raw ?? 0,
        history: mock.dividend?.history ?? []
      } : null,
      analyst: {
        targetPrice: fin.targetMeanPrice?.raw ?? mock.analyst.targetPrice,
        buyPct: hasRec ? Math.round(((rec.strongBuy + rec.buy) / total) * 100) : mock.analyst.buyPct,
        holdPct: hasRec ? Math.round((rec.hold / total) * 100) : mock.analyst.holdPct,
        sellPct: hasRec ? Math.round(((rec.sell + rec.strongSell) / total) * 100) : mock.analyst.sellPct
      },
      news: news.length ? news : mock.news
    };
  } catch (e) {
    return { ...mock, live: false };
  }
}

/* ---------------- financial trend charts: EPS, revenue, P/E, P/B ---------------- */
function mockFinancialTrends(ticker) {
  const rng = mulberry32(seedFromString(ticker + "trends" + dayStamp()));
  const price = basePrice(ticker);
  const baseEps = price * 0.01 + rng() * 2;
  const baseRev = 1 + rng() * 60; // $B
  const epsTrend = [];
  const revenueTrend = [];
  for (let i = 7; i >= 0; i--) {
    const drift = 1 + (rng() - 0.45) * 0.08 * (8 - i);
    epsTrend.push({ label: `Q${8 - i}`, actual: Math.round(baseEps * drift * 100) / 100 });
    revenueTrend.push({ label: `Q${8 - i}`, revenue: Math.round(baseRev * drift * 100) / 100 });
  }
  return {
    live: false,
    peRatio: Math.round((10 + rng() * 35) * 10) / 10,
    pbRatio: Math.round((1 + rng() * 12) * 10) / 10,
    epsTrend, revenueTrend
  };
}

async function getFinancialTrendsAsync(ticker) {
  ticker = ticker.toUpperCase();
  if (!USE_LIVE_FETCH) return mockFinancialTrends(ticker);

  const result = await withCache(`qsum_${ticker}`, 300000, () => fetchYahooQuoteSummary(ticker));
  if (!result) return mockFinancialTrends(ticker);

  try {
    const summary = result.summaryDetail || {};
    const stats = result.defaultKeyStatistics || {};
    const eh = result.earningsHistory?.history || [];
    const ish = result.incomeStatementHistoryQuarterly?.incomeStatementHistory || [];

    const epsTrend = eh
      .filter(h => h.epsActual?.raw != null && h.quarter?.raw)
      .sort((a, b) => a.quarter.raw - b.quarter.raw)
      .map(h => ({
        label: new Date(h.quarter.raw * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        actual: h.epsActual.raw,
        estimate: h.epsEstimate?.raw ?? null
      }));

    const revenueTrend = ish
      .filter(h => h.totalRevenue?.raw != null && h.endDate?.raw)
      .sort((a, b) => a.endDate.raw - b.endDate.raw)
      .map(h => ({
        label: new Date(h.endDate.raw * 1000).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: h.totalRevenue.raw / 1e9 // $B
      }));

    if (epsTrend.length === 0 && revenueTrend.length === 0) return mockFinancialTrends(ticker);

    const mock = mockFinancialTrends(ticker); // fills gaps if one series is missing
    return {
      live: true,
      peRatio: summary.trailingPE?.raw ?? null,
      pbRatio: stats.priceToBook?.raw ?? null,
      epsTrend: epsTrend.length ? epsTrend : mock.epsTrend,
      revenueTrend: revenueTrend.length ? revenueTrend : mock.revenueTrend
    };
  } catch (e) {
    return mockFinancialTrends(ticker);
  }
}

/* ---------------- background batch sync (sidebar + heatmap) ---------------- */
const _liveMarketCap = {}; // ticker -> { valueB, ts } — $ billions, matches data.js units

function getLiveMarketCapB(ticker) {
  return _liveMarketCap[ticker]?.valueB ?? null;
}

function seedLiveState(ticker, meta) {
  if (!meta) return;
  const s = liveQuoteState(ticker);
  const price = meta.regularMarketPrice;
  if (price == null) return;
  s.price = price;
  s.prevClose = meta.previousClose ?? meta.chartPreviousClose ?? s.prevClose;
  s.open = meta.regularMarketOpen ?? s.open;
  s.high = Math.max(s.high, meta.regularMarketDayHigh ?? price);
  s.low = Math.min(s.low, meta.regularMarketDayLow ?? price);
  s.volume = meta.regularMarketVolume ?? s.volume;
}

async function syncBatchQuotes(tickers, { concurrency = 4, delayMs = 300 } = {}) {
  let i = 0;
  async function worker() {
    while (i < tickers.length) {
      const ticker = tickers[i++];
      try {
        const p = await fetchYahooPriceOnly(ticker);
        if (p) {
          seedLiveState(ticker, {
            regularMarketPrice: p.regularMarketPrice?.raw,
            previousClose: p.regularMarketPreviousClose?.raw,
            regularMarketVolume: p.regularMarketVolume?.raw
          });
          if (p.marketCap?.raw != null) {
            _liveMarketCap[ticker] = { valueB: p.marketCap.raw / 1e9, ts: Date.now() };
          }
        }
      } catch (e) { /* keep old values, move on */ }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

let _batchSyncRunning = false;
async function runBackgroundSync() {
  if (!USE_LIVE_FETCH || _batchSyncRunning || typeof UNIVERSE === "undefined") return;
  _batchSyncRunning = true;
  try {
    await syncBatchQuotes(UNIVERSE.map(t => t.ticker));
    if (typeof onBackgroundSyncComplete === "function") onBackgroundSyncComplete();
  } finally {
    _batchSyncRunning = false;
  }
}
if (typeof window !== "undefined") {
  setTimeout(runBackgroundSync, 2000);
  setInterval(runBackgroundSync, 90000);
}

/* ============================================================
   MOCK ENGINE — deterministic, instant, never fails.
   Fallback for every live call above, and the cosmetic jitter
   loop that keeps the UI moving between real syncs.
   ============================================================ */

function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dayStamp() {
  return new Date().toISOString().slice(0, 10);
}

const _basePriceCache = {};
function basePrice(ticker) {
  if (_basePriceCache[ticker]) return _basePriceCache[ticker];
  const rng = mulberry32(seedFromString(ticker + dayStamp()));
  const p = 8 + Math.pow(rng(), 2.2) * 900;
  _basePriceCache[ticker] = Math.round(p * 100) / 100;
  return _basePriceCache[ticker];
}

const _liveState = {};
function liveQuoteState(ticker) {
  if (!_liveState[ticker] || _liveState[ticker].day !== dayStamp()) {
    const rng = mulberry32(seedFromString(ticker + dayStamp() + "open"));
    const base = basePrice(ticker);
    const openDrift = (rng() - 0.5) * base * 0.04;
    _liveState[ticker] = {
      day: dayStamp(),
      prevClose: base,
      open: base + openDrift,
      price: base + openDrift,
      high: base + Math.max(0, openDrift),
      low: base + Math.min(0, openDrift),
      volume: Math.floor(1_000_000 + mulberry32(seedFromString(ticker + "vol"))() * 40_000_000),
      rng: mulberry32(seedFromString(ticker + dayStamp() + "walk"))
    };
  }
  return _liveState[ticker];
}

function tickTicker(ticker) {
  const s = liveQuoteState(ticker);
  const step = (s.rng() - 0.5) * s.price * 0.0025;
  s.price = Math.max(0.5, s.price + step);
  s.high = Math.max(s.high, s.price);
  s.low = Math.min(s.low, s.price);
  s.volume += Math.floor(s.rng() * 15000);
  return s;
}

function getQuote(ticker) {
  ticker = ticker.toUpperCase();
  const s = tickTicker(ticker);
  const change = s.price - s.prevClose;
  const changePercent = (change / s.prevClose) * 100;
  return {
    ticker, price: s.price, open: s.open, high: s.high, low: s.low,
    prevClose: s.prevClose, change, changePercent, volume: s.volume
  };
}

const _tickSubscribers = new Set();
let _tickLoopStarted = false;
function subscribeTick(fn) {
  _tickSubscribers.add(fn);
  if (!_tickLoopStarted) {
    _tickLoopStarted = true;
    setInterval(() => { for (const fn of _tickSubscribers) fn(); }, 2500);
  }
  return () => _tickSubscribers.delete(fn);
}

const RANGE_CONFIG = {
  "1D": { points: 78, stepMin: 5 },
  "5D": { points: 65, stepMin: 30 },
  "1M": { points: 22, stepMin: 60 * 24 },
  "6M": { points: 26, stepMin: 60 * 24 * 7 },
  "1Y": { points: 52, stepMin: 60 * 24 * 7 }
};

function getHistory(ticker, range) {
  ticker = ticker.toUpperCase();
  const cfg = RANGE_CONFIG[range] || RANGE_CONFIG["1D"];
  const rng = mulberry32(seedFromString(ticker + range + dayStamp()));
  const end = basePrice(ticker);
  let price = end * (0.85 + rng() * 0.3);
  const candles = [];
  const now = Date.now();
  for (let i = 0; i < cfg.points; i++) {
    const drift = (rng() - 0.48) * price * 0.018;
    const open = price;
    price = Math.max(0.5, price + drift);
    const close = price;
    const high = Math.max(open, close) + rng() * price * 0.006;
    const low = Math.min(open, close) - rng() * price * 0.006;
    const volume = Math.floor(500000 + rng() * 20_000_000);
    const t = now - (cfg.points - i) * cfg.stepMin * 60000;
    candles.push({ t, open, high, low, close, volume });
  }
  const live = getQuote(ticker);
  candles[candles.length - 1].close = live.price;
  candles[candles.length - 1].high = Math.max(candles[candles.length - 1].high, live.price);
  candles[candles.length - 1].low = Math.min(candles[candles.length - 1].low, live.price);
  return candles;
}

function getFundamentals(ticker) {
  ticker = ticker.toUpperCase();
  const rng = mulberry32(seedFromString(ticker + "fund" + dayStamp()));
  const price = basePrice(ticker);

  const daysToEarnings = 3 + Math.floor(rng() * 80);
  const nextEarnings = new Date(Date.now() + daysToEarnings * 86400000);
  const epsEstimate = Math.round((price * 0.01 + rng() * 2) * 100) / 100;
  const epsHistory = [];
  for (let i = 4; i >= 1; i--) {
    const est = Math.round((epsEstimate * (0.8 + rng() * 0.4)) * 100) / 100;
    const beat = rng() > 0.35;
    const actual = Math.round((est + (beat ? 1 : -1) * rng() * est * 0.15) * 100) / 100;
    epsHistory.push({ quarter: `Q${((4 - i) % 4) + 1}`, estimate: est, actual, beat });
  }

  const paysDividend = rng() > 0.45;
  const dividend = paysDividend ? {
    yieldPct: Math.round(rng() * 3.2 * 100) / 100,
    exDivDate: new Date(Date.now() + Math.floor(rng() * 60) * 86400000),
    perShare: Math.round((price * 0.002 + rng() * 0.6) * 100) / 100,
    history: Array.from({ length: 4 }, (_, i) => ({
      quarter: `Q${i + 1}`, amount: Math.round((0.3 + rng() * 0.6) * 100) / 100
    }))
  } : null;

  const buyPct = Math.floor(30 + rng() * 55);
  const holdPct = Math.floor(rng() * (95 - buyPct));
  const sellPct = 100 - buyPct - holdPct;
  const targetPrice = Math.round(price * (1 + (rng() - 0.35) * 0.25) * 100) / 100;

  const newsHeadlines = [
    `${ticker} extends move as sector rotation continues`,
    `Analysts weigh in on ${ticker} ahead of next print`,
    `${ticker} trading volume picks up into the close`,
    `What to watch in ${ticker} this earnings season`
  ];

  return {
    ticker,
    earnings: { date: nextEarnings, epsEstimate, history: epsHistory },
    dividend,
    analyst: { targetPrice, buyPct, holdPct, sellPct },
    news: newsHeadlines.map((headline, i) => ({
      headline, time: new Date(Date.now() - i * 3.2 * 3600000)
    }))
  };
}
