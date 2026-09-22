/* ============================================================
   QTERMINAL — market.js

   THREE REAL DATA PROVIDERS NOW WIRED IN:
   - Finnhub: quote, chart candles, market cap, dividends, earnings
     calendar, analyst recommendation/price target. Free tier ~60
     calls/min, and it sets its own CORS headers, so these calls go
     straight to finnhub.io — no proxy needed, unlike Yahoo.
   - FMP (Financial Modeling Prep): quarterly EPS/revenue and,
     importantly, quarterly P/E and P/B history — Yahoo's free
     endpoint doesn't expose historical P/E or P/B at all, FMP does.
     Free tier is tight (250 req/day total), so these responses are
     cached in the visitor's browser (localStorage, 24h) rather than
     just in memory, to stretch that quota as far as possible.
   - Marketaux: news, both per-ticker and the globe's world feed.
     Its articles come with real per-entity country data, which
     replaced the keyword-guessing the globe page's news blips used
     to run on.
   Yahoo Finance (through the CORS proxy, as before) is kept as a
   fallback specifically for chart candles, since Finnhub's candle
   endpoint is commonly restricted for US equities on the free tier
   and this needs something that actually works either way.

   IMPORTANT — READ BEFORE ADDING MORE KEYS:
   This is a static site with no backend, so every key below ships
   in plain text to anyone who views page source or opens dev
   tools. That's fine for Finnhub (generous free quota, low value to
   abuse) but means ALL visitors share these quotas, not just you —
   FMP's 250/day in particular could get burned through fast with
   real traffic despite the caching here. The real fix, before this
   depends on FMP for anything important, is a small serverless
   function (Cloudflare Worker etc.) that holds the keys server-side
   and the site calls instead — then the key never reaches the
   browser at all.
   ============================================================ */

const API_KEYS = {
  marketaux: "buGA7m3crIEm4Elsh5YYMJ7hN3Ws5IPBo9r9CxkF",
  finnhub: "dao8gl9r01qqjqh5c6p0dao8gl9r01qqjqh5c6pg",
  fmp: "5sEZFUKxxoGkwPRZBtphP0DCdbm2mkN9"
};

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

// ---- tiny in-memory TTL cache (resets on page load) ----
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

// ---- persistent (localStorage) TTL cache — for FMP's tight quota ----
function lsGet(key) {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
}
function lsSet(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* storage full/unavailable — just skip caching */ }
}
async function withPersistentCache(key, ttlMs, fetcher) {
  const cached = lsGet(key);
  const now = Date.now();
  if (cached && now - cached.ts < ttlMs) return cached.data;
  const data = await fetcher();
  if (data != null) {
    lsSet(key, { data, ts: now });
    return data;
  }
  return cached ? cached.data : null;
}

/* ---------------- Finnhub (direct, no proxy) ---------------- */
const FINNHUB_BASE = "https://finnhub.io/api/v1";
function finnhubUrl(path, params) {
  const q = new URLSearchParams({ ...params, token: API_KEYS.finnhub });
  return `${FINNHUB_BASE}${path}?${q.toString()}`;
}
const dstr = (d) => d.toISOString().slice(0, 10);

async function fetchFinnhubQuote(ticker) {
  return await fetchJson(finnhubUrl("/quote", { symbol: ticker }));
}
async function fetchFinnhubProfile(ticker) {
  return await fetchJson(finnhubUrl("/stock/profile2", { symbol: ticker }));
}
async function fetchFinnhubEarningsCalendar(ticker) {
  const from = dstr(new Date());
  const to = dstr(new Date(Date.now() + 120 * 86400000));
  const json = await fetchJson(finnhubUrl("/calendar/earnings", { symbol: ticker, from, to }));
  return json?.earningsCalendar || null;
}
async function fetchFinnhubRecommendation(ticker) {
  return await fetchJson(finnhubUrl("/stock/recommendation", { symbol: ticker }));
}
async function fetchFinnhubPriceTarget(ticker) {
  return await fetchJson(finnhubUrl("/stock/price-target", { symbol: ticker }));
}
async function fetchFinnhubDividends(ticker) {
  const from = dstr(new Date(Date.now() - 2 * 365 * 86400000));
  const to = dstr(new Date());
  return await fetchJson(finnhubUrl("/stock/dividend", { symbol: ticker, from, to }));
}
// Resolution/free-tier note: Finnhub commonly restricts /stock/candle
// for US equities on the free plan — this is attempted and quietly
// falls back to Yahoo (below) if it comes back empty/restricted.
async function fetchFinnhubCandle(ticker, resolution, fromUnix, toUnix) {
  const json = await fetchJson(finnhubUrl("/stock/candle", { symbol: ticker, resolution, from: fromUnix, to: toUnix }));
  if (!json || json.s !== "ok" || !json.c || json.c.length === 0) return null;
  const candles = json.t.map((t, i) => ({
    t: t * 1000, open: json.o[i], high: json.h[i], low: json.l[i], close: json.c[i], volume: json.v[i]
  }));
  return candles;
}

/* ---------------- FMP — quarterly EPS, revenue, P/E, P/B ---------------- */
const FMP_BASE = "https://financialmodelingprep.com/api/v3";
function fmpUrl(path, params) {
  const q = new URLSearchParams({ ...params, apikey: API_KEYS.fmp });
  return `${FMP_BASE}${path}?${q.toString()}`;
}
async function fetchFMPIncomeQuarterly(ticker) {
  return await fetchJson(fmpUrl(`/income-statement/${ticker}`, { period: "quarter", limit: "8" }));
}
async function fetchFMPKeyMetricsQuarterly(ticker) {
  return await fetchJson(fmpUrl(`/key-metrics/${ticker}`, { period: "quarter", limit: "8" }));
}

/* ---------------- Marketaux — news, with real per-article country data ---------------- */
const MARKETAUX_BASE = "https://api.marketaux.com/v1/news/all";
async function fetchMarketauxNews({ symbols, countries, limit = 6 } = {}) {
  const params = new URLSearchParams({
    api_token: API_KEYS.marketaux,
    language: "en",
    filter_entities: "true",
    limit: String(limit)
  });
  if (symbols) params.set("symbols", symbols);
  if (countries) params.set("countries", countries);
  const json = await fetchJson(`${MARKETAUX_BASE}?${params.toString()}`);
  return json?.data || null;
}

/* ---------------- Yahoo (fallback only now — chart candles, and as a last resort elsewhere) ---------------- */
const RANGE_TO_YF = {
  "1D": { range: "1d", interval: "5m" },
  "5D": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "6M": { range: "6mo", interval: "1wk" },
  "1Y": { range: "1y", interval: "1wk" }
};
const RANGE_TO_FINNHUB = {
  "1D": { resolution: "5", fromMs: 1 * 86400000 },
  "5D": { resolution: "30", fromMs: 5 * 86400000 },
  "1M": { resolution: "D", fromMs: 30 * 86400000 },
  "6M": { resolution: "D", fromMs: 183 * 86400000 },
  "1Y": { resolution: "W", fromMs: 365 * 86400000 }
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

/* ---------------- public async API: quote / history / fundamentals ---------------- */
async function getHistoryAsync(ticker, range) {
  ticker = ticker.toUpperCase();
  if (USE_LIVE_FETCH) {
    const ttl = range === "1D" ? 20000 : range === "5D" ? 60000 : 300000;

    // try Finnhub candles first (direct, no proxy)
    const fhCfg = RANGE_TO_FINNHUB[range] || RANGE_TO_FINNHUB["1D"];
    const toUnix = Math.floor(Date.now() / 1000);
    const fromUnix = Math.floor((Date.now() - fhCfg.fromMs) / 1000);
    const fhCandles = await withCache(`fhchart_${ticker}_${range}`, ttl,
      () => fetchFinnhubCandle(ticker, fhCfg.resolution, fromUnix, toUnix));
    if (fhCandles && fhCandles.length > 1) {
      seedLiveState(ticker, {
        regularMarketPrice: fhCandles[fhCandles.length - 1].close,
        regularMarketDayHigh: Math.max(...fhCandles.map(c => c.high)),
        regularMarketDayLow: Math.min(...fhCandles.map(c => c.low))
      });
      return { candles: fhCandles, live: true, source: "finnhub" };
    }

    // Finnhub candle often restricted on free tier for US equities — fall back to Yahoo
    const live = await withCache(`chart_${ticker}_${range}`, ttl, () => fetchYahooChart(ticker, range));
    if (live && live.candles.length > 1) {
      seedLiveState(ticker, live.meta);
      return { candles: live.candles, meta: live.meta, live: true, source: "yahoo" };
    }
  }
  return { candles: getHistory(ticker, range), live: false };
}

async function getQuoteAsync(ticker) {
  ticker = ticker.toUpperCase();
  if (USE_LIVE_FETCH) {
    const q = await withCache(`fhquote_${ticker}`, 20000, () => fetchFinnhubQuote(ticker));
    if (q && q.c) {
      seedLiveState(ticker, {
        regularMarketPrice: q.c, previousClose: q.pc, regularMarketOpen: q.o,
        regularMarketDayHigh: q.h, regularMarketDayLow: q.l
      });
      return { ...getQuote(ticker), live: true };
    }
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

  try {
    const [profile, earnCal, rec, target, divs, news] = await Promise.all([
      withCache(`fhprofile_${ticker}`, 21600000, () => fetchFinnhubProfile(ticker)),         // 6h
      withCache(`fhearn_${ticker}`, 3600000, () => fetchFinnhubEarningsCalendar(ticker)),     // 1h
      withCache(`fhrec_${ticker}`, 3600000, () => fetchFinnhubRecommendation(ticker)),        // 1h
      withCache(`fhtarget_${ticker}`, 3600000, () => fetchFinnhubPriceTarget(ticker)),        // 1h
      withCache(`fhdiv_${ticker}`, 21600000, () => fetchFinnhubDividends(ticker)),            // 6h
      withCache(`mxnews_${ticker}`, 300000, () => fetchMarketauxNews({ symbols: ticker, limit: 4 })) // 5m
    ]);

    const anyLive = !!(profile || earnCal || rec || target || divs || news);
    if (!anyLive) return { ...mock, live: false };

    const nextEarn = Array.isArray(earnCal) && earnCal.length
      ? earnCal.slice().sort((a, b) => new Date(a.date) - new Date(b.date))[0]
      : null;

    const recRow = Array.isArray(rec) && rec.length ? rec[0] : null;
    const recTotal = recRow ? (recRow.strongBuy + recRow.buy + recRow.hold + recRow.sell + recRow.strongSell) : 0;

    const latestDiv = Array.isArray(divs) && divs.length ? divs[0] : null;

    const newsItems = (news || []).map(n => ({
      headline: n.title,
      url: n.url,
      publisher: n.source,
      time: n.published_at ? new Date(n.published_at) : new Date()
    }));

    return {
      ticker,
      live: true,
      marketCap: profile?.marketCapitalization != null ? profile.marketCapitalization * 1e6 : null, // Finnhub reports in $M
      earnings: {
        date: nextEarn ? new Date(nextEarn.date) : mock.earnings.date,
        epsEstimate: nextEarn?.epsEstimate ?? mock.earnings.epsEstimate,
        history: mock.earnings.history // per-quarter beat/miss table stays simulated — no free source for it lined up yet
      },
      dividend: latestDiv ? {
        yieldPct: mock.dividend?.yieldPct ?? 0, // Finnhub's dividend endpoint gives payments, not trailing yield — left simulated
        exDivDate: latestDiv.exDate ? new Date(latestDiv.exDate) : new Date(),
        perShare: latestDiv.amount ?? 0,
        history: divs.slice(0, 4).map((d, i) => ({ quarter: `Q${i + 1}`, amount: d.amount ?? 0 }))
      } : null,
      analyst: {
        targetPrice: target?.targetMean ?? mock.analyst.targetPrice,
        buyPct: recRow && recTotal ? Math.round(((recRow.strongBuy + recRow.buy) / recTotal) * 100) : mock.analyst.buyPct,
        holdPct: recRow && recTotal ? Math.round((recRow.hold / recTotal) * 100) : mock.analyst.holdPct,
        sellPct: recRow && recTotal ? Math.round(((recRow.sell + recRow.strongSell) / recTotal) * 100) : mock.analyst.sellPct
      },
      news: newsItems.length ? newsItems : mock.news
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

  try {
    // FMP quota is tight (250/day total, shared across every visitor),
    // so these are cached in the browser for 24h, not just in-memory.
    const [income, metrics] = await Promise.all([
      withPersistentCache(`fmp_income_${ticker}`, 86400000, () => fetchFMPIncomeQuarterly(ticker)),
      withPersistentCache(`fmp_metrics_${ticker}`, 86400000, () => fetchFMPKeyMetricsQuarterly(ticker))
    ]);

    if ((!income || income.length === 0) && (!metrics || metrics.length === 0)) {
      return mockFinancialTrends(ticker);
    }

    const epsTrend = Array.isArray(income) ? income
      .filter(r => r.eps != null && r.date)
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => ({
        label: new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        actual: r.eps
      })) : [];

    const revenueTrend = Array.isArray(income) ? income
      .filter(r => r.revenue != null && r.date)
      .slice()
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .map(r => ({
        label: new Date(r.date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        revenue: r.revenue / 1e9
      })) : [];

    const latestMetric = Array.isArray(metrics) && metrics.length ? metrics[0] : null;

    const mock = mockFinancialTrends(ticker); // fills gaps if one series is missing
    return {
      live: true,
      peRatio: latestMetric?.peRatio ?? null,
      pbRatio: latestMetric?.pbRatio ?? null,
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

// Quote sync: Finnhub /quote, direct (no proxy). Paced at ~1 req/sec
// (well under the 60/min free-tier ceiling, leaving headroom for
// whatever the currently-viewed ticker's own calls are doing).
async function syncBatchQuotes(tickers, { concurrency = 1, delayMs = 1100 } = {}) {
  let i = 0;
  async function worker() {
    while (i < tickers.length) {
      const ticker = tickers[i++];
      try {
        const q = await fetchFinnhubQuote(ticker);
        if (q && q.c) {
          seedLiveState(ticker, { regularMarketPrice: q.c, previousClose: q.pc, regularMarketOpen: q.o, regularMarketDayHigh: q.h, regularMarketDayLow: q.l });
        }
      } catch (e) { /* keep old values, move on */ }
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
}

// Market cap sync: separate, much slower pass (profile2), cached to
// localStorage for 6h per ticker so most calls in a given cycle get
// skipped entirely once populated — market cap doesn't move enough
// intraday to justify checking it as often as price.
async function syncMarketCaps(tickers, { concurrency = 1, delayMs = 1100 } = {}) {
  let i = 0;
  async function worker() {
    while (i < tickers.length) {
      const ticker = tickers[i++];
      const cacheKey = `fh_cap_${ticker}`;
      const cached = lsGet(cacheKey);
      if (cached && Date.now() - cached.ts < 21600000) {
        _liveMarketCap[ticker] = { valueB: cached.data, ts: cached.ts };
        continue; // skip the network call entirely — still fresh
      }
      try {
        const p = await fetchFinnhubProfile(ticker);
        if (p?.marketCapitalization != null) {
          const valueB = p.marketCapitalization / 1000; // Finnhub reports $M
          _liveMarketCap[ticker] = { valueB, ts: Date.now() };
          lsSet(cacheKey, { data: valueB, ts: Date.now() });
        }
      } catch (e) { /* keep old value */ }
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
let _capSyncRunning = false;
async function runMarketCapSync() {
  if (!USE_LIVE_FETCH || _capSyncRunning || typeof UNIVERSE === "undefined") return;
  _capSyncRunning = true;
  try {
    await syncMarketCaps(UNIVERSE.map(t => t.ticker));
  } finally {
    _capSyncRunning = false;
  }
}
if (typeof window !== "undefined") {
  setTimeout(runBackgroundSync, 2000);
  setInterval(runBackgroundSync, 120000); // ~90 tickers @ ~1.1s pace ≈ 100s, so 120s keeps cycles from overlapping
  setTimeout(runMarketCapSync, 6000);
  setInterval(runMarketCapSync, 1800000); // every 30 min — most calls skip anyway once localStorage-cached
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
  if (!ticker) return { ticker: null, price: 0, open: 0, high: 0, low: 0, prevClose: 0, change: 0, changePercent: 0, volume: 0 };
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
