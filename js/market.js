/* ============================================================
   QTERMINAL — market.js
   Data layer. Everything the UI needs comes through the four
   functions at the bottom: getQuote, getHistory, getFundamentals,
   subscribeTick.

   HOW THIS WORKS RIGHT NOW (no API key, per your answer):
   - USE_LIVE_FETCH is false by default. All numbers are generated
     by a deterministic pseudo-random engine seeded off the ticker
     symbol + the current day, so a given ticker looks the same
     within a session and moves a small, plausible amount every
     few seconds to feel "live".

   SWAPPING IN REAL DATA LATER:
   - Set USE_LIVE_FETCH = true.
   - fetchLiveQuote() below calls Yahoo Finance's unofficial chart
     endpoint through a public CORS proxy (api.allorigins.win),
     since browsers block direct cross-origin calls to Yahoo and
     Yahoo doesn't send CORS headers itself.
   - This is fine for a personal/demo project but NOT something to
     depend on for anything real: public CORS proxies rate-limit,
     go down, and can be slow. For a real deployment, run your own
     tiny serverless function (Cloudflare Worker / Vercel edge
     function) that fetches Yahoo/Stooq server-side and returns
     JSON — then point fetchLiveQuote() at that instead.
   - If the live fetch fails for any reason, everything silently
     falls back to the mock engine, so the UI never breaks.
   ============================================================ */

const USE_LIVE_FETCH = false;
const CORS_PROXY = "https://api.allorigins.win/raw?url=";

// ---- deterministic PRNG (mulberry32), seeded per ticker+day ----
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

// Base price per ticker — plausible, stable within a session.
const _basePriceCache = {};
function basePrice(ticker) {
  if (_basePriceCache[ticker]) return _basePriceCache[ticker];
  const rng = mulberry32(seedFromString(ticker + dayStamp()));
  // spread base prices across a realistic range, weighted low
  const p = 8 + Math.pow(rng(), 2.2) * 900;
  _basePriceCache[ticker] = Math.round(p * 100) / 100;
  return _basePriceCache[ticker];
}

// Live jitter state — small running walk per ticker, reset daily.
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
    ticker,
    price: s.price,
    open: s.open,
    high: s.high,
    low: s.low,
    prevClose: s.prevClose,
    change,
    changePercent,
    volume: s.volume
  };
}

// Broadcast-style subscription so multiple UI pieces (sidebar row,
// header, heatmap tile) can all stay in sync off one tick loop.
const _tickSubscribers = new Set();
let _tickLoopStarted = false;
function subscribeTick(fn) {
  _tickSubscribers.add(fn);
  if (!_tickLoopStarted) {
    _tickLoopStarted = true;
    setInterval(() => {
      for (const fn of _tickSubscribers) fn();
    }, 2500);
  }
  return () => _tickSubscribers.delete(fn);
}

// ---- history (OHLCV candles) ----
const RANGE_CONFIG = {
  "1D": { points: 78, stepMin: 5 },      // 6.5h session in 5-min bars
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
  // last candle snaps to current live price so chart matches header
  const live = getQuote(ticker);
  candles[candles.length - 1].close = live.price;
  candles[candles.length - 1].high = Math.max(candles[candles.length - 1].high, live.price);
  candles[candles.length - 1].low = Math.min(candles[candles.length - 1].low, live.price);
  return candles;
}

// ---- fundamentals: earnings, dividends, analyst expectations ----
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
      quarter: `Q${i + 1}`,
      amount: Math.round((0.3 + rng() * 0.6) * 100) / 100
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
      headline,
      time: new Date(Date.now() - i * 3.2 * 3600000)
    }))
  };
}

// ---- live-fetch hook (documented above, off by default) ----
async function fetchLiveQuote(ticker) {
  if (!USE_LIVE_FETCH) return null;
  try {
    const url = `${CORS_PROXY}${encodeURIComponent(
      `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}`
    )}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;
    const meta = result.meta;
    return {
      ticker,
      price: meta.regularMarketPrice,
      prevClose: meta.previousClose ?? meta.chartPreviousClose,
      volume: meta.regularMarketVolume ?? 0
    };
  } catch (e) {
    return null; // fall back to mock engine silently
  }
}
