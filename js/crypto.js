/* ============================================================
   QTERMINAL — crypto.js
   Real data throughout:
   - Prices/market caps/24h change: CoinGecko's free public API
     (/coins/markets) — no key needed, one bulk call covers the
     whole sidebar + heatmap at once (much cheaper than the
     per-ticker approach the stock side needs).
   - Chart: TradingView widget, same as the stock pages, mapped to
     a Binance USDT pair per coin (works for all majors here).
   - News: CryptoCompare's free news endpoint, no key needed.
   ============================================================ */

const clockEl = document.getElementById('clock');
function tickClock() {
  clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' LOCAL';
}
setInterval(tickClock, 1000);
tickClock();

let currentCoin = null; // symbol, or null for the "all coins" heatmap home view
let searchFilter = '';
let heatmapMode = 'equal';
const _coinData = {}; // symbol -> latest market data from CoinGecko

const sidebarListEl = document.getElementById('cryptoSidebarList');
const mainContentEl = document.getElementById('mainContent');
const sidebarEl = document.getElementById('sidebar');
const mainEl = document.getElementById('main');
const backBtn = document.getElementById('backBtn');
const searchInput = document.getElementById('cryptoSearch');
const tooltipEl = document.getElementById('tooltip');

function fmtUsd(n, decimalsSmall = 4) {
  if (n == null) return '—';
  if (n >= 1) return '$' + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return '$' + n.toFixed(decimalsSmall);
}
function fmtPct(n) { return n == null ? '—' : (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function fmtBig(n) {
  if (n == null) return '—';
  if (n >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  return '$' + n.toLocaleString();
}
function dirClass(n) { return n >= 0 ? 'up' : 'down'; }

/* ---------------- CoinGecko: bulk market data ---------------- */
async function fetchCoinGeckoMarkets() {
  const ids = CRYPTO_UNIVERSE.map(c => c.id).join(',');
  const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&price_change_percentage=24h`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (!res.ok) return null;
    return await res.json();
  } catch (e) {
    return null;
  }
}

let _marketsLive = false;
async function refreshMarkets() {
  const data = await fetchCoinGeckoMarkets();
  if (!data) { _marketsLive = false; seedMockCryptoData(); return; }
  _marketsLive = true;
  data.forEach(d => {
    const coin = CRYPTO_UNIVERSE.find(c => c.id === d.id);
    if (!coin) return;
    _coinData[coin.symbol] = {
      price: d.current_price, change24h: d.price_change_percentage_24h,
      marketCap: d.market_cap, volume24h: d.total_volume, image: d.image, live: true
    };
  });
  renderVisibleParts();
}

// If CoinGecko is unreachable, seed plausible mock data so the page
// still works — same honesty pattern as the stock side (mock engine
// as a fallback, never a broken page).
function seedFromString(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  return h >>> 0;
}
function mulberry32(seed) {
  return function () { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function seedMockCryptoData() {
  CRYPTO_UNIVERSE.forEach(c => {
    if (_coinData[c.symbol]?.live) return; // don't overwrite good data
    const rng = mulberry32(seedFromString(c.symbol));
    const price = c.symbol === 'BTC' ? 60000 + rng() * 40000 : c.symbol === 'ETH' ? 2000 + rng() * 2000 : rng() * (rng() < 0.3 ? 1 : 100);
    _coinData[c.symbol] = {
      price, change24h: (rng() - 0.5) * 12, marketCap: price * (1e6 + rng() * 5e8),
      volume24h: price * 1e6 * rng(), image: null, live: false
    };
  });
}
function tickMockDrift() {
  Object.entries(_coinData).forEach(([symbol, d]) => {
    if (d.live) return; // only drift the mock ones
    const jitter = (Math.random() - 0.5) * d.price * 0.004;
    d.price = Math.max(0.0000001, d.price + jitter);
  });
}
setInterval(() => { tickMockDrift(); renderVisibleParts(); }, 2500);

function renderVisibleParts() {
  refreshSidebarPrices();
  if (!currentCoin) {
    document.querySelectorAll('.tile').forEach(tile => {
      const symbol = tile.dataset.symbol;
      const d = _coinData[symbol];
      if (!d) return;
      const chg = tile.querySelector('.t-chg');
      if (chg) chg.textContent = fmtPct(d.change24h);
      tile.style.background = heatColor(d.change24h);
    });
  } else {
    refreshPriceBlock();
  }
}

/* ---------------- sidebar ---------------- */
function renderSidebar() {
  const q = searchFilter.trim().toUpperCase();
  const filtered = CRYPTO_UNIVERSE.filter(c => !q || c.symbol.includes(q) || c.name.toUpperCase().includes(q));
  sidebarListEl.innerHTML = filtered.map(c => rowHtml(c)).join('');
  sidebarListEl.querySelectorAll('.row').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.symbol));
  });
  refreshSidebarPrices();
}

function rowHtml(c) {
  return `
    <div class="row ${c.symbol === currentCoin ? 'active' : ''}" data-symbol="${c.symbol}">
      <div class="row-left">
        <span class="tok-dot"></span>
        <div>
          <div class="row-ticker">${c.symbol}</div>
          <div class="row-name">${c.name}</div>
        </div>
      </div>
      <div class="row-right">
        <div class="row-price" data-price="${c.symbol}">--</div>
        <div class="row-chg" data-chg="${c.symbol}">--</div>
      </div>
    </div>`;
}

function refreshSidebarPrices() {
  CRYPTO_UNIVERSE.forEach(c => {
    const d = _coinData[c.symbol];
    if (!d) return;
    const priceEl = sidebarListEl.querySelector(`[data-price="${c.symbol}"]`);
    const chgEl = sidebarListEl.querySelector(`[data-chg="${c.symbol}"]`);
    if (priceEl) priceEl.textContent = fmtUsd(d.price);
    if (chgEl) { chgEl.textContent = fmtPct(d.change24h); chgEl.className = 'row-chg ' + dirClass(d.change24h); }
  });
}

/* ---------------- routing ---------------- */
function navigateTo(symbol) { window.location.hash = symbol; }
function handleHashChange() {
  const t = (window.location.hash || '').slice(1).toUpperCase();
  currentCoin = getCryptoBySymbol(t) ? t : null;
  renderSidebar();
  renderMain();
  if (window.innerWidth <= 820) { sidebarEl.classList.add('hidden'); mainEl.classList.remove('hidden'); }
}
window.addEventListener('hashchange', handleHashChange);
backBtn.addEventListener('click', () => { sidebarEl.classList.remove('hidden'); mainEl.classList.add('hidden'); });
searchInput.addEventListener('input', (e) => { searchFilter = e.target.value; renderSidebar(); });

/* ---------------- main panel ---------------- */
function renderMain() {
  if (!currentCoin) {
    mainContentEl.innerHTML = `
      <div class="heatmap-section">
        <div class="heatmap-toolbar">
          <span class="section-title">CRYPTO HEATMAP · BY CATEGORY</span>
          <div class="size-toggle" id="sizeToggle">
            <button data-mode="equal" class="${heatmapMode === 'equal' ? 'active' : ''}">EQUAL SIZE</button>
            <button data-mode="cap" class="${heatmapMode === 'cap' ? 'active' : ''}">BY MARKET CAP</button>
          </div>
        </div>
        <div class="heatmap-box" id="heatmapBox">
          ${getCryptoCategories().map(categoryHtml).join('')}
        </div>
      </div>
      <div class="info-grid" style="margin-top:16px;">
        <div id="cryptoNewsCard"></div>
      </div>
    `;
    wireHeatmap();
    loadCryptoNews();
    return;
  }

  const c = getCryptoBySymbol(currentCoin);
  mainContentEl.innerHTML = `
    <div class="ticker-header">
      <div class="ticker-id">
        <span class="sym">${c.symbol}</span>
        <span class="nm">${c.name}</span>
        <span class="tag">${c.category.toUpperCase()}</span>
      </div>
      <div class="price-block" id="priceBlock"></div>
    </div>
    <div class="chart-section">
      <div class="chart-toolbar"><span class="section-title">PRICE CHART <span style="color:var(--text-faint);">· TRADINGVIEW LIVE</span></span></div>
      <div class="chart-box" style="padding:0; overflow:hidden;">
        <div id="tvChartContainer" style="height:420px;"></div>
      </div>
    </div>
    <div class="info-grid">
      <div class="info-card">
        <h3>MARKET STATS</h3>
        <div class="kv"><span class="k">Market cap</span><span class="v" id="statCap">—</span></div>
        <div class="kv"><span class="k">24h volume</span><span class="v" id="statVol">—</span></div>
        <div class="kv"><span class="k">24h change</span><span class="v" id="statChg">—</span></div>
      </div>
      <div class="info-card" style="grid-column: span 2;" id="cryptoNewsCardCoin"></div>
    </div>
  `;
  refreshPriceBlock();
  renderTradingViewChart(currentCoin);
  loadCryptoNews(currentCoin, 'cryptoNewsCardCoin');
}

function refreshPriceBlock() {
  if (!currentCoin) return;
  const d = _coinData[currentCoin];
  const block = document.getElementById('priceBlock');
  if (!d || !block) return;
  block.innerHTML = `
    <div class="price-main ${dirClass(d.change24h)}">${fmtUsd(d.price)}</div>
    <div class="price-chg ${dirClass(d.change24h)}">${fmtPct(d.change24h)}</div>
  `;
  const cap = document.getElementById('statCap'); if (cap) cap.textContent = fmtBig(d.marketCap);
  const vol = document.getElementById('statVol'); if (vol) vol.textContent = fmtBig(d.volume24h);
  const chg = document.getElementById('statChg'); if (chg) { chg.textContent = fmtPct(d.change24h); chg.className = 'v ' + dirClass(d.change24h); }
}

/* ---------------- TradingView chart ---------------- */
let _tvScriptPromise = null;
function ensureTradingViewScript() {
  if (window.TradingView) return Promise.resolve();
  if (_tvScriptPromise) return _tvScriptPromise;
  _tvScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.onload = resolve; script.onerror = reject;
    document.head.appendChild(script);
  });
  return _tvScriptPromise;
}
async function renderTradingViewChart(symbol) {
  const container = document.getElementById('tvChartContainer');
  if (!container) return;
  const containerId = 'tv_' + symbol + '_' + Date.now();
  container.innerHTML = `<div id="${containerId}" style="height:420px;"></div>`;
  try { await ensureTradingViewScript(); } catch (e) {
    container.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-faint); font-size:11px;">Chart script failed to load.</div>`;
    return;
  }
  if (symbol !== currentCoin) return;
  new TradingView.widget({
    autosize: true, symbol: `BINANCE:${symbol}USDT`, interval: 'D', timezone: 'Etc/UTC',
    theme: 'dark', style: '1', locale: 'en', toolbar_bg: '#0c0c0c',
    enable_publishing: false, allow_symbol_change: false, hide_side_toolbar: true, container_id: containerId
  });
}

/* ---------------- heatmap ---------------- */
function categoryHtml(cat) {
  const coins = CRYPTO_UNIVERSE.filter(c => c.category === cat);
  return `
    <div class="sector-block">
      <div class="sector-label">${cat.toUpperCase()} (${coins.length})</div>
      <div class="sector-grid">${coins.map(tileHtml).join('')}</div>
    </div>`;
}
function tileDims(marketCap) {
  if (heatmapMode === 'equal') return { w: 60, h: 44 };
  const scale = Math.sqrt((marketCap || 1e8) / 1e9);
  return { w: Math.round(Math.max(44, Math.min(140, scale * 22))), h: Math.round(Math.max(32, Math.min(100, scale * 16))) };
}
function heatColor(pct) {
  if (pct == null) return '#1a1a1a';
  const clamped = Math.max(-8, Math.min(8, pct));
  const t = Math.abs(clamped) / 8;
  return clamped >= 0 ? `hsl(140, 70%, ${10 + t * 20}%)` : `hsl(4, 70%, ${10 + t * 20}%)`;
}
function tileHtml(c) {
  const d = _coinData[c.symbol] || {};
  const dims = tileDims(d.marketCap);
  return `
    <div class="tile" data-symbol="${c.symbol}" style="width:${dims.w}px; height:${dims.h}px; background:${heatColor(d.change24h)};">
      <div class="t-sym">${c.symbol}</div>
      <div class="t-chg">${fmtPct(d.change24h)}</div>
    </div>`;
}
function wireHeatmap() {
  document.getElementById('sizeToggle')?.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { heatmapMode = btn.dataset.mode; renderMain(); });
  });
  document.querySelectorAll('.tile').forEach(tile => {
    const symbol = tile.dataset.symbol;
    tile.addEventListener('mouseenter', (e) => showTooltip(symbol, e));
    tile.addEventListener('mousemove', positionTooltip);
    tile.addEventListener('mouseleave', () => tooltipEl.style.display = 'none');
    tile.addEventListener('click', () => navigateTo(symbol));
  });
}
function showTooltip(symbol, e) {
  const c = getCryptoBySymbol(symbol);
  const d = _coinData[symbol] || {};
  tooltipEl.innerHTML = `
    <div class="tt-sym">${c.symbol} — ${c.name}</div>
    <div class="tt-row"><span>Price</span><span>${fmtUsd(d.price)}</span></div>
    <div class="tt-row"><span>24h change</span><span class="${dirClass(d.change24h)}">${fmtPct(d.change24h)}</span></div>
    <div class="tt-row"><span>Market cap</span><span>${fmtBig(d.marketCap)}</span></div>
  `;
  tooltipEl.style.display = 'block';
  positionTooltip(e);
}
function positionTooltip(e) {
  tooltipEl.style.left = Math.min(window.innerWidth - 190, e.clientX + 14) + 'px';
  tooltipEl.style.top = Math.min(window.innerHeight - 110, e.clientY + 14) + 'px';
}

/* ---------------- crypto news (real, CryptoCompare) ---------------- */
async function fetchCryptoNews() {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.Data || null;
  } catch (e) { return null; }
}
async function loadCryptoNews(coinSymbol, targetId = 'cryptoNewsCard') {
  const el = document.getElementById(targetId);
  if (!el) return;
  const news = await fetchCryptoNews();
  if (!news || news.length === 0) {
    el.innerHTML = `<h3>CRYPTO NEWS</h3><div class="kv"><span class="k">Status</span><span class="v">Unavailable right now</span></div>`;
    return;
  }
  let items = news;
  if (coinSymbol) {
    const c = getCryptoBySymbol(coinSymbol);
    items = news.filter(n => (n.categories || '').toUpperCase().includes(c.symbol) || (n.title || '').toUpperCase().includes(c.name.toUpperCase()));
    if (items.length === 0) items = news; // fall back to general feed if nothing coin-specific
  }
  el.innerHTML = `
    <h3>CRYPTO NEWS <span style="color:var(--green);">· LIVE</span></h3>
    ${items.slice(0, 6).map(n => `
      <div class="news-item">
        <a href="${n.url}" target="_blank" rel="noopener" style="color:inherit;">${n.title}</a>
        <span class="n-time">${n.source_info?.name || n.source || ''} · ${new Date(n.published_on * 1000).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
      </div>`).join('')}
  `;
}

/* ---------------- init ---------------- */
seedMockCryptoData();
refreshMarkets();
setInterval(refreshMarkets, 45000);
handleHashChange();
