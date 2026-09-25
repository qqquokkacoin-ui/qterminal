/* ============================================================
   QTERMINAL — app.js
   ============================================================ */

const sidebarListEl = document.getElementById('sidebarList');
const mainContentEl = document.getElementById('mainContent');
const sidebarEl = document.getElementById('sidebar');
const mainEl = document.getElementById('main');
const backBtn = document.getElementById('backBtn');
const searchInput = document.getElementById('tickerSearch');
const tooltipEl = document.getElementById('tooltip');
const clockEl = document.getElementById('clock');

let currentTicker = 'QQQ';
let heatmapMode = 'equal'; // 'equal' | 'cap'
let searchFilter = '';

// Which of the 20 markets we're viewing — from ?idx=XXX in the URL,
// defaulting to NASDAQ-100. NDX keeps using data.js's original
// UNIVERSE/CONSTITUENTS/INDEX_TICKER (unchanged, so the portfolio
// builder and reward-preference picker — both intentionally scoped
// to NASDAQ-100's tokenized set — don't need touching); the other
// 19 read from markets-data.js via the wrappers below.
const _urlParams = new URLSearchParams(window.location.search);
let currentMarket = (_urlParams.get('idx') || 'NDX').toUpperCase();
if (currentMarket !== 'NDX' && typeof getMarket === 'function' && !getMarket(currentMarket)) {
  currentMarket = 'NDX'; // unknown ?idx= value — fall back rather than break
}

function activeIndexTicker() {
  return currentMarket === 'NDX' ? INDEX_TICKER : getMarket(currentMarket).indexTicker;
}
function activeConstituents() {
  return currentMarket === 'NDX' ? CONSTITUENTS : getMarket(currentMarket).constituents;
}
function activeUniverse() {
  return currentMarket === 'NDX' ? UNIVERSE : getMarketUniverse(currentMarket);
}
function activeTickerData(ticker) {
  return currentMarket === 'NDX' ? getTickerData(ticker) : getMarketTickerData(currentMarket, ticker);
}
function activeSectors() {
  return currentMarket === 'NDX' ? getSectors() : getMarketSectors(currentMarket);
}
function activeMarketName() {
  return currentMarket === 'NDX' ? 'NASDAQ-100' : getMarket(currentMarket).name;
}

// TradingView exchange prefixes per market — spot-check these
// against TradingView's own symbol search after deploying; a wrong
// prefix just shows "symbol not found" inside the widget, it can't
// break the rest of the page.
const TV_EXCHANGE_PREFIX = {
  NDX: 'NASDAQ:', DJI: '', SPX: '', // US: NDX stays NASDAQ:, Dow/S&P mix NYSE+NASDAQ so left to TradingView's auto-resolve
  FTSE: 'LSE:', GDAXI: 'XETR:', FCHI: 'EURONEXT:', STOXX50E: '',
  N225: 'TSE:', HSI: 'HKEX:', SSEC: 'SSE:', KS11: 'KRX:',
  SENSEX: 'BSE:', AXJO: 'ASX:', GSPTSE: 'TSX:', BVSP: 'BMFBOVESPA:',
  IBEX: 'BME:', FTSEMIB: 'MIL:', SMI: 'SWX:', STI: 'SGX:', TWII: 'TWSE:'
};

// Robinhood doesn't publish per-ticker deep links for stock tokens,
// so every "ROBINHOOD TOKENIZED" tag points to the general trading
// page where a Robinhood Wallet user can search for and trade any
// of the tokens (per-ticker deep links can slot in here if Robinhood
// ever exposes them).
const ROBINHOOD_TRADE_URL = 'https://robinhood.com/rhj/stocktokens/';

/* ---------------- clock ---------------- */
function tickClock() {
  const now = new Date();
  clockEl.textContent = now.toLocaleTimeString('en-US', { hour12: false }) + ' LOCAL';
}
setInterval(tickClock, 1000);
tickClock();

/* ---------------- helpers ---------------- */
function fmtPrice(n) { return n.toFixed(n >= 1000 ? 2 : 2); }
function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'; }
function fmtChg(n) { return (n >= 0 ? '+' : '') + n.toFixed(2); }
function fmtVol(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function fmtDate(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function dirClass(n) { return n >= 0 ? 'up' : 'down'; }

/* ---------------- sidebar ---------------- */
function renderSidebar() {
  const q = searchFilter.trim().toUpperCase();
  const indexT = activeIndexTicker();
  const rest = activeConstituents()
    .filter(t => !q || t.ticker.includes(q) || t.name.toUpperCase().includes(q))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  const showIndex = !q || indexT.ticker.includes(q) || indexT.name.toUpperCase().includes(q);

  let html = '';
  if (showIndex) {
    html += rowHtml(indexT, true);
    html += `<div class="sidebar-divider">${activeMarketName().toUpperCase()} CONSTITUENTS (${rest.length})</div>`;
  }
  html += rest.map(t => rowHtml(t, false)).join('');
  sidebarListEl.innerHTML = html;

  sidebarListEl.querySelectorAll('.row').forEach(el => {
    el.addEventListener('click', () => {
      navigateTo(el.dataset.ticker);
    });
  });
  refreshSidebarPrices();
}

function rowHtml(t, pinned) {
  return `
    <div class="row ${pinned ? 'pinned' : ''} ${t.ticker === currentTicker ? 'active' : ''}" data-ticker="${t.ticker}">
      <div class="row-left">
        <span class="tok-dot ${t.tokenized ? 'tokenized' : ''}"></span>
        <div>
          <div class="row-ticker">${t.ticker}</div>
          <div class="row-name">${t.name}</div>
        </div>
      </div>
      <div class="row-right">
        <div class="row-price" data-price="${t.ticker}">--</div>
        <div class="row-chg" data-chg="${t.ticker}">--</div>
      </div>
    </div>`;
}

function refreshSidebarPrices() {
  activeUniverse().forEach(t => {
    const q = getQuote(t.ticker);
    const priceEl = sidebarListEl.querySelector(`[data-price="${t.ticker}"]`);
    const chgEl = sidebarListEl.querySelector(`[data-chg="${t.ticker}"]`);
    if (priceEl) priceEl.textContent = fmtPrice(q.price);
    if (chgEl) {
      chgEl.textContent = fmtPct(q.changePercent);
      chgEl.className = 'row-chg ' + dirClass(q.changePercent);
    }
  });
}

// Called by market.js once a background batch sync finishes, so real
// numbers show up immediately instead of waiting for the next tick.
// Note: the background sync itself only covers NASDAQ-100 (see
// market.js) — the other 19 markets run on the mock engine's
// realistic drift rather than real batch-synced quotes, to avoid
// blowing through API quotas across ~800 additional tickers. Any
// single ticker you actually open still gets a real on-demand quote
// regardless of which market it's in.
function onBackgroundSyncComplete() {
  refreshSidebarPrices();
  if (currentTicker === activeIndexTicker().ticker) {
    document.querySelectorAll('.tile').forEach(tile => {
      const ticker = tile.dataset.ticker;
      const q = getQuote(ticker);
      const chg = tile.querySelector('.t-chg');
      if (chg) chg.textContent = fmtPct(q.changePercent);
      tile.style.background = heatColor(q.changePercent);
    });
  }
}

/* ---------------- routing ---------------- */
function navigateTo(ticker) {
  window.location.hash = ticker;
}
function handleHashChange() {
  const t = (window.location.hash || '#' + activeIndexTicker().ticker).slice(1).toUpperCase();
  if (t === 'PORTFOLIO') {
    currentTicker = null;
    stopWhaleActivityPolling();
    renderSidebar();
    renderPortfolioView();
    if (window.innerWidth <= 820) {
      sidebarEl.classList.add('hidden');
      mainEl.classList.remove('hidden');
    }
    return;
  }
  currentTicker = activeTickerData(t) ? t : activeIndexTicker().ticker;
  renderSidebar();
  renderMain();
  if (window.innerWidth <= 820) {
    sidebarEl.classList.add('hidden');
    mainEl.classList.remove('hidden');
  }
}
window.addEventListener('hashchange', handleHashChange);

backBtn.addEventListener('click', () => {
  sidebarEl.classList.remove('hidden');
  mainEl.classList.add('hidden');
});
searchInput.addEventListener('input', (e) => {
  searchFilter = e.target.value;
  renderSidebar();
});

/* ---------------- main panel ---------------- */
function renderMain() {
  const meta = activeTickerData(currentTicker);
  const isIndex = currentTicker === activeIndexTicker().ticker;
  const tokenizedTag = meta.tokenized
    ? `<a class="tag tokenized" href="${ROBINHOOD_TRADE_URL}" target="_blank" rel="noopener" title="Trade on Robinhood">ROBINHOOD TOKENIZED ↗</a>`
    : `<span class="tag">NOT TOKENIZED</span>`;

  mainContentEl.innerHTML = `
    ${isIndex ? heatmapSectionHtml() : ''}
    ${isIndex ? '<div class="info-grid" style="margin-top:0; margin-bottom:18px;"><div id="whaleActivity"><div class="info-card" style="grid-column:1/-1;"><h3>$QTRM ON-CHAIN ACTIVITY</h3><div class="kv"><span class="k">Status</span><span class="v">Loading…</span></div></div></div></div>' : ''}
    <div class="ticker-header">
      <div class="ticker-id">
        <span class="sym">${meta.ticker}</span>
        <span class="nm">${meta.name}</span>
        ${tokenizedTag}
      </div>
      <div class="price-block" id="priceBlock"></div>
    </div>

    <div class="chart-section">
      <div class="chart-toolbar">
        <span class="section-title">PRICE CHART <span style="color:var(--text-faint);">· TRADINGVIEW LIVE</span></span>
      </div>
      <div class="chart-box" style="padding:0; overflow:hidden;">
        <div id="tvChartContainer" style="height:420px;"></div>
      </div>
    </div>

    <div class="info-grid" id="fundamentalsGrid"></div>
    <div class="info-grid" style="margin-top:12px;" id="newsGrid"></div>
    ${!isIndex ? '<div class="info-grid" style="margin-top:12px;"><div id="financialsGrid"></div></div>' : ''}
    <div class="info-grid" style="margin-top:12px;">
      <div id="premiumGate"></div>
    </div>
  `;

  refreshPriceBlock();
  // Paint instantly with mock data (never blocks on network), then
  // silently upgrade to real data as soon as it resolves. Perceived
  // load time is ~0ms.
  const mockF = getFundamentals(currentTicker);
  document.getElementById('fundamentalsGrid').innerHTML =
    earningsCardHtml({ ...mockF, live: false }) + dividendCardHtml({ ...mockF, live: false }) + analystCardHtml({ ...mockF, live: false });
  document.getElementById('newsGrid').innerHTML = newsCardHtml({ ...mockF, live: false });

  renderTradingViewChart(currentTicker);
  loadFundamentals(currentTicker);
  if (!isIndex) loadFinancialTrends(currentTicker);
  refreshGatedSections();

  if (isIndex) {
    wireHeatmap();
    startWhaleActivityPolling(document.getElementById('whaleActivity'));
  } else {
    stopWhaleActivityPolling();
  }
}

async function loadFundamentals(ticker) {
  const f = await getFundamentalsAsync(ticker);
  if (ticker !== currentTicker) return; // user navigated away while we waited
  const grid = document.getElementById('fundamentalsGrid');
  const newsGrid = document.getElementById('newsGrid');
  if (grid) grid.innerHTML = earningsCardHtml(f) + dividendCardHtml(f) + analystCardHtml(f);
  if (newsGrid) newsGrid.innerHTML = newsCardHtml(f);
}

async function loadFinancialTrends(ticker) {
  const t = await getFinancialTrendsAsync(ticker);
  if (ticker !== currentTicker) return;
  const grid = document.getElementById('financialsGrid');
  if (!grid) return;
  grid.innerHTML = financialsCardHtml(t);
  requestAnimationFrame(() => {
    drawTrendChart('epsTrendCanvas', t.epsTrend.map(x => x.actual), '#ffb238');
    drawTrendChart('revTrendCanvas', t.revenueTrend.map(x => x.revenue), '#00c805');
  });
}

function financialsCardHtml(t) {
  const lastEps = t.epsTrend.length ? t.epsTrend[t.epsTrend.length - 1].actual : null;
  const lastRev = t.revenueTrend.length ? t.revenueTrend[t.revenueTrend.length - 1].revenue : null;
  return `
    <div class="info-card" style="grid-column:1/-1;">
      <h3>FINANCIALS ${liveBadge(t)}</h3>
      <div class="info-grid" style="grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:12px;">
        <div class="kv"><span class="k">P/E</span><span class="v">${t.peRatio != null ? t.peRatio.toFixed(1) : '—'}</span></div>
        <div class="kv"><span class="k">P/B</span><span class="v">${t.pbRatio != null ? t.pbRatio.toFixed(1) : '—'}</span></div>
        <div class="kv"><span class="k">Latest EPS</span><span class="v">${lastEps != null ? '$' + lastEps.toFixed(2) : '—'}</span></div>
        <div class="kv"><span class="k">Latest revenue</span><span class="v">${lastRev != null ? '$' + lastRev.toFixed(2) + 'B' : '—'}</span></div>
      </div>
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px;">
        <div>
          <div class="section-title" style="margin-bottom:4px; font-size:9px;">EPS TREND · QUARTERLY</div>
          <canvas id="epsTrendCanvas" height="60" style="width:100%; display:block;"></canvas>
        </div>
        <div>
          <div class="section-title" style="margin-bottom:4px; font-size:9px;">REVENUE TREND · $B, QUARTERLY</div>
          <canvas id="revTrendCanvas" height="60" style="width:100%; display:block;"></canvas>
        </div>
      </div>
      ${!t.live ? `<div class="kv" style="margin-top:10px;"><span class="k">Note</span><span class="v" style="font-size:10px; color:var(--text-faint); text-align:right;">P/E &amp; P/B history isn't available from this free data source — trend shown is simulated until live figures resolve.</span></div>` : ''}
    </div>`;
}

function drawTrendChart(canvasId, values, color) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !values || values.length === 0) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth || 200;
  const cssHeight = 60;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const min = Math.min(...values, 0);
  const max = Math.max(...values);
  const pad = 4;
  const gap = (cssWidth - pad * 2) / values.length;
  const barW = gap * 0.55;

  values.forEach((v, i) => {
    const h = Math.max(1, ((v - min) / ((max - min) || 1)) * (cssHeight - pad * 2));
    const x = pad + i * gap + (gap - barW) / 2;
    const y = cssHeight - pad - h;
    ctx.globalAlpha = 0.35 + 0.65 * (i / (values.length - 1 || 1));
    ctx.fillStyle = color;
    ctx.fillRect(x, y, barW, h);
  });
  ctx.globalAlpha = 1;
}

function refreshPriceBlock() {
  if (!currentTicker) return; // no ticker on this page (e.g. portfolio view)
  const q = getQuote(currentTicker);
  const block = document.getElementById('priceBlock');
  if (!block) return;
  block.innerHTML = `
    <div class="price-main ${dirClass(q.change)}">${fmtPrice(q.price)}</div>
    <div class="price-chg ${dirClass(q.change)}">${fmtChg(q.change)} (${fmtPct(q.changePercent)})</div>
    <div class="price-meta">O ${fmtPrice(q.open)} &nbsp; H ${fmtPrice(q.high)} &nbsp; L ${fmtPrice(q.low)} &nbsp; VOL ${fmtVol(q.volume)}</div>
  `;
}

function liveBadge(f) {
  return f.live
    ? `<span style="color:var(--green); font-size:9px; letter-spacing:0.08em;">· LIVE</span>`
    : `<span style="color:var(--text-faint); font-size:9px; letter-spacing:0.08em;">· DEMO DATA</span>`;
}

function earningsCardHtml(f) {
  return `
    <div class="info-card">
      <h3>EARNINGS ${liveBadge(f)}</h3>
      <div class="kv"><span class="k">Next report</span><span class="v">${fmtDate(f.earnings.date)}</span></div>
      <div class="kv"><span class="k">EPS estimate</span><span class="v">$${f.earnings.epsEstimate.toFixed(2)}</span></div>
      ${f.marketCap ? `<div class="kv"><span class="k">Market cap</span><span class="v">$${(f.marketCap / 1e9).toFixed(1)}B</span></div>` : ''}
      <div style="margin-top:8px;">
        ${f.earnings.history.map(h => `
          <div class="eps-row">
            <span>${h.quarter}</span>
            <span>est $${h.estimate.toFixed(2)}</span>
            <span class="${h.beat ? 'beat' : 'miss'}">act $${h.actual.toFixed(2)} ${h.beat ? '▲' : '▼'}</span>
          </div>`).join('')}
      </div>
    </div>`;
}

function dividendCardHtml(f) {
  if (!f.dividend) {
    return `<div class="info-card"><h3>DIVIDENDS ${liveBadge(f)}</h3><div class="kv"><span class="k">Status</span><span class="v">No dividend</span></div></div>`;
  }
  const d = f.dividend;
  return `
    <div class="info-card">
      <h3>DIVIDENDS ${liveBadge(f)}</h3>
      <div class="kv"><span class="k">Yield</span><span class="v">${d.yieldPct.toFixed(2)}%</span></div>
      <div class="kv"><span class="k">Per share</span><span class="v">$${d.perShare.toFixed(2)}</span></div>
      <div class="kv"><span class="k">Ex-div date</span><span class="v">${fmtDate(d.exDivDate)}</span></div>
      <div style="margin-top:8px;">
        ${d.history.map(h => `<div class="eps-row"><span>${h.quarter}</span><span>$${h.amount.toFixed(2)}</span></div>`).join('')}
      </div>
    </div>`;
}

function analystCardHtml(f) {
  const a = f.analyst;
  const q = getQuote(f.ticker);
  const upside = ((a.targetPrice - q.price) / q.price) * 100;
  return `
    <div class="info-card">
      <h3>ANALYST EXPECTATIONS ${liveBadge(f)}</h3>
      <div class="kv"><span class="k">Price target</span><span class="v">$${a.targetPrice.toFixed(2)}</span></div>
      <div class="kv"><span class="k">Implied</span><span class="v ${dirClass(upside)}">${fmtPct(upside)}</span></div>
      <div class="analyst-bar">
        <span class="buy" style="width:${a.buyPct}%"></span>
        <span class="hold" style="width:${a.holdPct}%"></span>
        <span class="sell" style="width:${a.sellPct}%"></span>
      </div>
      <div class="kv"><span class="k">Buy / Hold / Sell</span><span class="v">${a.buyPct}% / ${a.holdPct}% / ${a.sellPct}%</span></div>
    </div>`;
}

function newsCardHtml(f) {
  return `
    <div class="info-card" style="grid-column: 1 / -1;">
      <h3>NEWS ${liveBadge(f)}</h3>
      ${f.news.map(n => `
        <div class="news-item">
          ${n.url ? `<a href="${n.url}" target="_blank" rel="noopener" style="color:inherit;">${n.headline}</a>` : n.headline}
          <span class="n-time">${n.publisher ? n.publisher + ' · ' : ''}${n.time.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
        </div>`).join('')}
    </div>`;
}

/* ---------------- chart: TradingView Advanced Chart widget ---------------- */
// Real, live, fully interactive — TradingView serves this data
// directly (their infrastructure, not our proxy chain), so this
// sidesteps every reliability issue the old hand-rolled candle
// fetch had. Exchange prefix comes from TV_EXCHANGE_PREFIX per
// market (see top of file) since it differs by exchange — wrong
// prefixes just show "symbol not found" inside TradingView's own
// widget, not a broken page.
let _tvScriptPromise = null;
function ensureTradingViewScript() {
  if (window.TradingView) return Promise.resolve();
  if (_tvScriptPromise) return _tvScriptPromise;
  _tvScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/tv.js';
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
  return _tvScriptPromise;
}

async function renderTradingViewChart(ticker) {
  const container = document.getElementById('tvChartContainer');
  if (!container) return;
  const containerId = 'tv_' + ticker + '_' + Date.now();
  container.innerHTML = `<div id="${containerId}" style="height:420px;"></div>`;

  try {
    await ensureTradingViewScript();
  } catch (e) {
    container.innerHTML = `<div style="padding:30px; text-align:center; color:var(--text-faint); font-size:11px;">
      Chart script failed to load (blocked or offline).</div>`;
    return;
  }
  if (ticker !== currentTicker) return; // navigated away while the script was loading

  new TradingView.widget({
    autosize: true,
    symbol: (TV_EXCHANGE_PREFIX[currentMarket] || '') + ticker,
    interval: 'D',
    timezone: 'Etc/UTC',
    theme: 'dark',
    style: '1',
    locale: 'en',
    toolbar_bg: '#0c0c0c',
    enable_publishing: false,
    allow_symbol_change: false,
    hide_side_toolbar: true,
    container_id: containerId
  });
}

/* ---------------- heatmap ---------------- */
function heatmapSectionHtml() {
  return `
    <div class="heatmap-section">
      <div class="heatmap-toolbar">
        <span class="section-title">${activeMarketName().toUpperCase()} HEATMAP · BY SECTOR</span>
        <div class="size-toggle" id="sizeToggle">
          <button data-mode="equal" class="${heatmapMode === 'equal' ? 'active' : ''}">EQUAL SIZE</button>
          <button data-mode="cap" class="${heatmapMode === 'cap' ? 'active' : ''}">BY MARKET CAP</button>
        </div>
      </div>
      <div class="heatmap-box" id="heatmapBox">
        ${activeSectors().map(sectorHtml).join('')}
      </div>
    </div>`;
}

function sectorHtml(sector) {
  const stocks = activeConstituents().filter(s => s.sector === sector);
  return `
    <div class="sector-block">
      <div class="sector-label">${sector.toUpperCase()} (${stocks.length})</div>
      <div class="sector-grid">
        ${stocks.map(s => tileHtml(s)).join('')}
      </div>
    </div>`;
}

function tileHtml(s) {
  const q = getQuote(s.ticker);
  const liveCap = getLiveMarketCapB(s.ticker);
  const dims = tileDims(liveCap ?? s.marketCapB);
  const bg = heatColor(q.changePercent);
  return `
    <div class="tile ${s.tokenized ? 'tokenized' : ''}" data-ticker="${s.ticker}"
         style="width:${dims.w}px; height:${dims.h}px; background:${bg};">
      <div class="t-sym">${s.ticker}</div>
      <div class="t-chg">${fmtPct(q.changePercent)}</div>
    </div>`;
}

function tileDims(marketCapB) {
  if (heatmapMode === 'equal') return { w: 60, h: 44 };
  const scale = Math.sqrt(marketCapB); // area proportional to market cap
  const w = Math.max(44, Math.min(140, scale * 6));
  const h = Math.max(32, Math.min(100, scale * 4.2));
  return { w: Math.round(w), h: Math.round(h) };
}

function heatColor(pct) {
  const clamped = Math.max(-3, Math.min(3, pct));
  const t = Math.abs(clamped) / 3; // 0..1 intensity
  if (clamped >= 0) {
    // green scale
    const l = 10 + t * 20;
    return `hsl(140, 70%, ${l}%)`;
  } else {
    const l = 10 + t * 20;
    return `hsl(4, 70%, ${l}%)`;
  }
}

function wireHeatmap() {
  document.getElementById('sizeToggle').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      heatmapMode = btn.dataset.mode;
      renderMain();
    });
  });
  document.querySelectorAll('.tile').forEach(tile => {
    const ticker = tile.dataset.ticker;
    tile.addEventListener('mouseenter', (e) => showTooltip(ticker, e));
    tile.addEventListener('mousemove', (e) => positionTooltip(e));
    tile.addEventListener('mouseleave', hideTooltip);
    tile.addEventListener('click', () => navigateTo(ticker));
  });
}

function showTooltip(ticker, e) {
  const meta = activeTickerData(ticker);
  const q = getQuote(ticker);
  tooltipEl.innerHTML = `
    <div class="tt-sym">${meta.ticker} — ${meta.name}</div>
    <div class="tt-row"><span>Price</span><span>${fmtPrice(q.price)}</span></div>
    <div class="tt-row"><span>Change</span><span class="${dirClass(q.changePercent)}">${fmtPct(q.changePercent)}</span></div>
    <div class="tt-row"><span>Volume</span><span>${fmtVol(q.volume)}</span></div>
    <div class="tt-row"><span>Tokenized</span><span>${meta.tokenized ? 'Yes' : 'No'}</span></div>
  `;
  tooltipEl.style.display = 'block';
  positionTooltip(e);
}
function positionTooltip(e) {
  tooltipEl.style.left = Math.min(window.innerWidth - 190, e.clientX + 14) + 'px';
  tooltipEl.style.top = Math.min(window.innerHeight - 110, e.clientY + 14) + 'px';
}
function hideTooltip() { tooltipEl.style.display = 'none'; }

/* ---------------- premium / wallet-gated demo section ---------------- */
// Example of how token-gated content should be wired: swap the
// contents of the unlocked renderer for whatever the real premium
// feature ends up being (whale alerts, onchain flow, etc).
function refreshGatedSections() {
  const el = document.getElementById('premiumGate');
  if (!el) return;
  renderGate(el, 'On-chain Whale Activity', (container) => {
    container.innerHTML = `
      <div class="info-card" style="grid-column: 1 / -1;">
        <h3>ON-CHAIN WHALE ACTIVITY — UNLOCKED</h3>
        <div class="kv"><span class="k">Status</span><span class="v up">Premium feature active</span></div>
        <div class="kv"><span class="k">Content</span><span class="v">Wire up the real feature here</span></div>
      </div>`;
  });
}

/* ---------------- custom portfolio backtester (SHELL for "buy" — see note) ---------------- */
// "BUY" here is still a simulation — actually executing a purchase
// needs a real brokerage/exchange backend to send the order to,
// which doesn't exist yet (Robinhood has no public trading API for
// this). Backtesting, saving, and live performance tracking below
// are all real and fully functional; only the purchase itself is a
// no-op that shows what WOULD have happened.
//
// Saved portfolios live in this browser's localStorage — there's no
// backend/database, so they don't sync across devices and clearing
// browser data clears them. That's an honest tradeoff of staying a
// static, no-backend site; a real account system would need a
// server component.
const PORTFOLIOS_KEY = 'qterminal_portfolios';
function loadSavedPortfolios() {
  try { return JSON.parse(localStorage.getItem(PORTFOLIOS_KEY) || '[]'); } catch (e) { return []; }
}
function saveSavedPortfoliosList(list) {
  try { localStorage.setItem(PORTFOLIOS_KEY, JSON.stringify(list)); } catch (e) { /* storage unavailable */ }
}

let portfolioSelections = {}; // ticker -> weight (%), builder state
let portfolioFilters = { search: '', sector: 'all', cap: 'all' };
let backtestRange = '1Y';
let lastBacktestResult = null;
let portfolioViewMode = 'list'; // 'list' | 'builder'

function renderPortfolioView() {
  if (portfolioViewMode === 'builder') renderPortfolioBuilder();
  else renderPortfolioList();
}

/* ---- list of saved portfolios, with live tracked performance ---- */
function renderPortfolioList() {
  const list = loadSavedPortfolios();
  mainContentEl.innerHTML = `
    <div class="ticker-header">
      <div class="ticker-id">
        <span class="sym">PORTFOLIOS</span>
        <span class="nm">Backtest, save, and track custom tokenized-stock baskets</span>
      </div>
      <button class="enter-btn" id="pfNewBtn" style="padding:8px 18px; font-size:11px;">+ NEW BACKTEST</button>
    </div>
    <div id="pfListBody">
      ${list.length === 0 ? `
        <div class="info-card" style="grid-column:1/-1; text-align:center; padding:30px;">
          <div style="color:var(--text-dim); font-size:12px; margin-bottom:8px;">No saved portfolios yet.</div>
          <div style="color:var(--text-faint); font-size:11px;">Build one, backtest it, then save it here to track live performance.</div>
        </div>` : list.map(pf => portfolioCardHtml(pf)).join('')}
    </div>
  `;
  document.getElementById('pfNewBtn').addEventListener('click', () => {
    portfolioViewMode = 'builder';
    portfolioSelections = {};
    lastBacktestResult = null;
    renderPortfolioView();
  });
  document.querySelectorAll('.pf-delete-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      saveSavedPortfoliosList(loadSavedPortfolios().filter(p => p.id !== btn.dataset.id));
      renderPortfolioList();
    });
  });
  refreshPortfolioListValues();
}

function portfolioCardHtml(pf) {
  const holdingsStr = pf.holdings.map(h => `${h.ticker} ${h.weight}%`).join(' · ');
  return `
    <div class="info-card" style="grid-column:1/-1; margin-bottom:12px;">
      <h3>${pf.name.toUpperCase()} <span style="color:var(--text-faint); font-weight:400;">· created ${new Date(pf.createdAt).toLocaleDateString()}</span></h3>
      <div class="kv"><span class="k">Holdings</span><span class="v" style="font-size:11px;">${holdingsStr}</span></div>
      <div class="kv"><span class="k">Invested</span><span class="v">$${pf.investedAmount.toFixed(2)}</span></div>
      <div class="kv"><span class="k">Current value</span><span class="v" data-pf-value="${pf.id}">—</span></div>
      <div class="kv"><span class="k">Return</span><span class="v" data-pf-return="${pf.id}">—</span></div>
      ${pf.backtest ? `<div class="kv"><span class="k">Backtested (${pf.backtest.range})</span><span class="v" style="font-size:10px; color:var(--text-faint);">${fmtPct(pf.backtest.totalReturnPct)} vs QQQ ${fmtPct(pf.backtest.benchmarkReturnPct)}</span></div>` : ''}
      <button class="wallet-modal-close pf-delete-btn" data-id="${pf.id}" style="width:auto; padding:5px 12px; margin-top:8px;">DELETE</button>
    </div>`;
}

function computePortfolioLiveStats(pf) {
  let currentValue = 0;
  pf.holdings.forEach(h => {
    const entryPrice = pf.entryPrices[h.ticker];
    const q = getQuote(h.ticker);
    const allocated = pf.investedAmount * (h.weight / 100);
    const shares = entryPrice > 0 ? allocated / entryPrice : 0;
    currentValue += shares * q.price;
  });
  const pnl = currentValue - pf.investedAmount;
  const pnlPct = pf.investedAmount > 0 ? (pnl / pf.investedAmount) * 100 : 0;
  return { currentValue, pnl, pnlPct };
}

function refreshPortfolioListValues() {
  loadSavedPortfolios().forEach(pf => {
    const stats = computePortfolioLiveStats(pf);
    const valEl = document.querySelector(`[data-pf-value="${pf.id}"]`);
    const retEl = document.querySelector(`[data-pf-return="${pf.id}"]`);
    if (valEl) valEl.textContent = '$' + stats.currentValue.toFixed(2);
    if (retEl) {
      retEl.textContent = `${fmtChg(stats.pnl)} (${fmtPct(stats.pnlPct)})`;
      retEl.className = 'v ' + dirClass(stats.pnl);
    }
  });
}

/* ---- builder: search/filter, pick weights, backtest ---- */
function capBucket(marketCapB) {
  if (marketCapB >= 200) return 'mega';
  if (marketCapB >= 10) return 'large';
  if (marketCapB >= 2) return 'mid';
  return 'small';
}

function renderPortfolioBuilder() {
  mainContentEl.innerHTML = `
    <div class="ticker-header">
      <div class="ticker-id">
        <span class="sym">NEW BACKTEST</span>
        <span class="nm">Pick tokenized stocks, set weights, backtest before you save</span>
        <span class="tag" style="border-color:var(--amber-dim); color:var(--amber-dim);">BUY = SIMULATED</span>
      </div>
      <button class="wallet-modal-close" id="pfBackBtn" style="width:auto; padding:8px 16px;">&larr; MY PORTFOLIOS</button>
    </div>

    <div class="chart-box" style="margin-bottom:12px;">
      <div class="kv"><span class="k">Amount to invest</span><span class="v">
        <input type="number" id="pfAmount" value="1000" min="0" class="wallet-input" style="width:140px; display:inline-block; margin:0;"> USD
      </span></div>
      <div class="kv"><span class="k">Total weight allocated</span><span class="v" id="pfTotalWeight">0%</span></div>
    </div>

    <div class="chart-box" style="margin-bottom:12px; display:flex; flex-wrap:wrap; gap:10px; align-items:center;">
      <input type="text" id="pfSearch" placeholder="SEARCH TICKER OR NAME" class="wallet-input" style="flex:1; min-width:160px; margin:0;" value="${portfolioFilters.search}">
      <select id="pfSectorFilter" class="wallet-input" style="width:auto; margin:0;">
        <option value="all">All sectors</option>
        ${getSectors().map(s => `<option value="${s}" ${portfolioFilters.sector === s ? 'selected' : ''}>${s}</option>`).join('')}
      </select>
      <select id="pfCapFilter" class="wallet-input" style="width:auto; margin:0;">
        <option value="all">All market caps</option>
        <option value="mega" ${portfolioFilters.cap === 'mega' ? 'selected' : ''}>Mega (&gt;$200B)</option>
        <option value="large" ${portfolioFilters.cap === 'large' ? 'selected' : ''}>Large ($10B&ndash;$200B)</option>
        <option value="mid" ${portfolioFilters.cap === 'mid' ? 'selected' : ''}>Mid ($2B&ndash;$10B)</option>
        <option value="small" ${portfolioFilters.cap === 'small' ? 'selected' : ''}>Small (&lt;$2B)</option>
      </select>
    </div>

    <div class="heatmap-box" id="pfStockList" style="margin-bottom:16px; max-height:320px; overflow-y:auto;"></div>

    <div class="info-card" id="pfSummary" style="grid-column:1/-1; margin-bottom:16px;">
      <h3>ALLOCATION PREVIEW</h3>
      <div class="kv"><span class="k">Status</span><span class="v">Select stocks and set weights above</span></div>
    </div>

    <div class="chart-toolbar" style="margin-bottom:8px;">
      <span class="section-title">BACKTEST LOOKBACK</span>
      <div class="range-toggle" id="pfRangeToggle">
        ${['1M', '6M', '1Y'].map(r => `<button data-range="${r}" class="${r === backtestRange ? 'active' : ''}">${r}</button>`).join('')}
      </div>
    </div>
    <button class="enter-btn" id="pfBacktestBtn" style="letter-spacing:0.15em; margin-bottom:16px;">RUN BACKTEST</button>

    <div id="pfBacktestResult"></div>
  `;

  document.getElementById('pfBackBtn').addEventListener('click', () => {
    portfolioViewMode = 'list';
    renderPortfolioView();
  });
  document.getElementById('pfAmount').addEventListener('input', updatePortfolioPreview);
  document.getElementById('pfSearch').addEventListener('input', (e) => { portfolioFilters.search = e.target.value; renderPortfolioStockList(); });
  document.getElementById('pfSectorFilter').addEventListener('change', (e) => { portfolioFilters.sector = e.target.value; renderPortfolioStockList(); });
  document.getElementById('pfCapFilter').addEventListener('change', (e) => { portfolioFilters.cap = e.target.value; renderPortfolioStockList(); });
  document.getElementById('pfRangeToggle').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => { backtestRange = btn.dataset.range; renderPortfolioBuilder(); });
  });
  document.getElementById('pfBacktestBtn').addEventListener('click', runBacktest);

  renderPortfolioStockList();
  updatePortfolioPreview();
  if (lastBacktestResult) renderBacktestResult();
}

function renderPortfolioStockList() {
  const container = document.getElementById('pfStockList');
  if (!container) return;
  const q = portfolioFilters.search.trim().toUpperCase();
  const filtered = CONSTITUENTS.filter(s => {
    if (!s.tokenized) return false;
    if (q && !s.ticker.includes(q) && !s.name.toUpperCase().includes(q)) return false;
    if (portfolioFilters.sector !== 'all' && s.sector !== portfolioFilters.sector) return false;
    if (portfolioFilters.cap !== 'all') {
      const cap = getLiveMarketCapB(s.ticker) ?? s.marketCapB;
      if (capBucket(cap) !== portfolioFilters.cap) return false;
    }
    return true;
  });
  container.innerHTML = filtered.length
    ? filtered.map(s => portfolioRowHtml(s)).join('')
    : `<div style="padding:16px; text-align:center; color:var(--text-faint); font-size:11px;">No matches</div>`;

  container.querySelectorAll('.pf-weight-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const ticker = inp.dataset.ticker;
      const val = parseFloat(inp.value) || 0;
      if (val > 0) portfolioSelections[ticker] = val;
      else delete portfolioSelections[ticker];
      updatePortfolioPreview();
    });
  });
}

function portfolioRowHtml(s) {
  const weight = portfolioSelections[s.ticker] || '';
  const capB = getLiveMarketCapB(s.ticker) ?? s.marketCapB;
  return `
    <div class="row" style="cursor:default;">
      <div class="row-left">
        <span class="tok-dot tokenized"></span>
        <div>
          <div class="row-ticker">${s.ticker}</div>
          <div class="row-name">${s.name} · ${s.sector} · $${capB.toFixed(0)}B</div>
        </div>
      </div>
      <div class="row-right" style="display:flex; align-items:center; gap:6px;">
        <input type="number" min="0" max="100" step="1" placeholder="0" value="${weight}"
               class="pf-weight-input wallet-input" data-ticker="${s.ticker}"
               style="width:60px; margin:0; text-align:right; padding:4px 6px;">
        <span style="font-size:11px; color:var(--text-faint);">%</span>
      </div>
    </div>`;
}

function updatePortfolioPreview() {
  const amount = parseFloat(document.getElementById('pfAmount')?.value) || 0;
  const totalWeight = Object.values(portfolioSelections).reduce((a, b) => a + b, 0);
  const totalEl = document.getElementById('pfTotalWeight');
  if (totalEl) {
    totalEl.textContent = totalWeight.toFixed(0) + '%';
    totalEl.className = 'v ' + (Math.abs(totalWeight - 100) < 0.5 ? 'up' : (totalWeight > 100 ? 'down' : ''));
  }

  const summary = document.getElementById('pfSummary');
  const entries = Object.entries(portfolioSelections);
  if (!summary) return;
  if (entries.length === 0) {
    summary.innerHTML = `<h3>ALLOCATION PREVIEW</h3><div class="kv"><span class="k">Status</span><span class="v">Select stocks and set weights above</span></div>`;
    return;
  }
  const rows = entries.map(([ticker, weight]) => {
    const q = getQuote(ticker);
    const dollarAmt = amount * (weight / 100);
    const shares = q.price > 0 ? dollarAmt / q.price : 0;
    return `<div class="kv"><span class="k">${ticker} (${weight}%)</span><span class="v">$${dollarAmt.toFixed(2)} · ${shares.toFixed(4)} tokens @ $${fmtPrice(q.price)}</span></div>`;
  }).join('');
  summary.innerHTML = `<h3>ALLOCATION PREVIEW</h3>${rows}`;
}

/* ---- backtest: real historical data, normalized portfolio vs QQQ ---- */
async function runBacktest() {
  const btn = document.getElementById('pfBacktestBtn');
  const resultEl = document.getElementById('pfBacktestResult');
  const totalWeight = Object.values(portfolioSelections).reduce((a, b) => a + b, 0);
  const entries = Object.entries(portfolioSelections).filter(([, w]) => w > 0);

  if (entries.length === 0) {
    resultEl.innerHTML = `<div class="burn-status error">Pick at least one stock and set a weight.</div>`;
    return;
  }
  if (Math.abs(totalWeight - 100) > 0.5) {
    resultEl.innerHTML = `<div class="burn-status error">Weights must total 100% (currently ${totalWeight.toFixed(0)}%).</div>`;
    return;
  }

  if (btn) { btn.disabled = true; btn.textContent = 'RUNNING BACKTEST…'; }
  resultEl.innerHTML = `<div class="burn-status pending">Fetching historical data…</div>`;

  try {
    const histories = await Promise.all(entries.map(([ticker]) => getHistoryAsync(ticker, backtestRange)));
    const benchmark = await getHistoryAsync('QQQ', backtestRange);

    const minLen = Math.min(...histories.map(h => h.candles.length), benchmark.candles.length);
    if (minLen < 2) {
      resultEl.innerHTML = `<div class="burn-status error">Not enough historical data to backtest right now.</div>`;
      return;
    }

    const portfolioSeries = [];
    const benchmarkSeries = [];
    for (let i = 0; i < minLen; i++) {
      let norm = 0;
      entries.forEach(([ticker, weight], idx) => {
        const candles = histories[idx].candles;
        const base = candles[candles.length - minLen];
        const cur = candles[candles.length - minLen + i];
        norm += (cur.close / base.close) * (weight / 100);
      });
      const bCandles = benchmark.candles;
      const bBase = bCandles[bCandles.length - minLen];
      const bCur = bCandles[bCandles.length - minLen + i];
      portfolioSeries.push({ t: bCur.t, value: norm });
      benchmarkSeries.push({ t: bCur.t, value: bCur.close / bBase.close });
    }

    const totalReturnPct = (portfolioSeries[portfolioSeries.length - 1].value - 1) * 100;
    const benchmarkReturnPct = (benchmarkSeries[benchmarkSeries.length - 1].value - 1) * 100;

    const rets = [];
    for (let i = 1; i < portfolioSeries.length; i++) rets.push(portfolioSeries[i].value / portfolioSeries[i - 1].value - 1);
    const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / (rets.length || 1);
    const volatilityPct = Math.sqrt(variance) * 100;

    let peak = -Infinity, maxDD = 0;
    portfolioSeries.forEach(p => { peak = Math.max(peak, p.value); maxDD = Math.min(maxDD, p.value / peak - 1); });

    const anyLive = histories.some(h => h.live) && benchmark.live;

    lastBacktestResult = {
      range: backtestRange, series: portfolioSeries, benchmarkSeries,
      totalReturnPct, benchmarkReturnPct, volatilityPct, maxDrawdownPct: maxDD * 100,
      live: anyLive
    };
    renderBacktestResult();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'RUN BACKTEST'; }
  }
}

function renderBacktestResult() {
  const resultEl = document.getElementById('pfBacktestResult');
  if (!resultEl || !lastBacktestResult) return;
  const r = lastBacktestResult;
  resultEl.innerHTML = `
    <div class="chart-section">
      <div class="chart-toolbar">
        <span class="section-title">BACKTEST RESULT · ${r.range} ${liveBadge(r)}</span>
      </div>
      <div class="chart-box">
        <canvas id="backtestChart" height="220"></canvas>
      </div>
    </div>
    <div class="info-grid" style="margin-bottom:16px;">
      <div class="info-card">
        <h3>PORTFOLIO</h3>
        <div class="kv"><span class="k">Total return</span><span class="v ${dirClass(r.totalReturnPct)}">${fmtPct(r.totalReturnPct)}</span></div>
        <div class="kv"><span class="k">Volatility (period)</span><span class="v">${r.volatilityPct.toFixed(2)}%</span></div>
        <div class="kv"><span class="k">Max drawdown</span><span class="v down">${r.maxDrawdownPct.toFixed(2)}%</span></div>
      </div>
      <div class="info-card">
        <h3>VS QQQ BENCHMARK</h3>
        <div class="kv"><span class="k">QQQ return</span><span class="v ${dirClass(r.benchmarkReturnPct)}">${fmtPct(r.benchmarkReturnPct)}</span></div>
        <div class="kv"><span class="k">Difference</span><span class="v ${dirClass(r.totalReturnPct - r.benchmarkReturnPct)}">${fmtPct(r.totalReturnPct - r.benchmarkReturnPct)}</span></div>
      </div>
      <div class="info-card" id="pfSaveCard">
        <h3>SAVE THIS PORTFOLIO</h3>
        <input type="text" id="pfNameInput" placeholder="Portfolio name" class="wallet-input">
        <button class="enter-btn" id="pfSaveBtn" style="width:100%; letter-spacing:0.1em; padding:8px;">SAVE &amp; BUY (SIMULATED)</button>
        <div id="pfSaveStatus" class="burn-status"></div>
      </div>
    </div>
  `;
  requestAnimationFrame(() => drawBacktestChart(document.getElementById('backtestChart'), r.series, r.benchmarkSeries));
  document.getElementById('pfSaveBtn').addEventListener('click', savePortfolio);
}

function drawBacktestChart(canvas, series, benchmarkSeries) {
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssHeight = 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const allValues = series.map(s => s.value).concat(benchmarkSeries.map(s => s.value));
  const minV = Math.min(...allValues), maxV = Math.max(...allValues);
  const padL = 46, padR = 8, padT = 14, padB = 8;
  const chartW = cssWidth - padL - padR;
  const chartH = cssHeight - padT - padB;

  ctx.strokeStyle = '#1a1a1a';
  ctx.fillStyle = '#5a5a5a';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (chartH * i) / 4;
    const val = maxV - ((maxV - minV) * i) / 4;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(cssWidth - padR, y); ctx.stroke();
    ctx.fillText(((val - 1) * 100).toFixed(0) + '%', padL - 6, y + 3);
  }

  function plot(data, color, lineWidth) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    data.forEach((d, i) => {
      const x = padL + (chartW * i) / (data.length - 1);
      const y = padT + chartH - ((d.value - minV) / ((maxV - minV) || 1)) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  plot(benchmarkSeries, 'rgba(122,122,122,0.8)', 1.3);
  plot(series, '#ffb238', 1.8);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffb238'; ctx.fillRect(padL, 2, 8, 3);
  ctx.fillStyle = '#d4d4d4'; ctx.fillText('Portfolio', padL + 12, 8);
  ctx.fillStyle = 'rgba(122,122,122,0.8)'; ctx.fillRect(padL + 90, 2, 8, 3);
  ctx.fillStyle = '#d4d4d4'; ctx.fillText('QQQ', padL + 102, 8);
}

async function savePortfolio() {
  const nameInput = document.getElementById('pfNameInput');
  const status = document.getElementById('pfSaveStatus');
  const name = nameInput?.value.trim();
  if (!name) { status.className = 'burn-status error'; status.textContent = 'Give it a name first.'; return; }

  const entries = Object.entries(portfolioSelections).filter(([, w]) => w > 0);
  const amount = parseFloat(document.getElementById('pfAmount')?.value) || 0;
  const entryPrices = {};
  entries.forEach(([ticker]) => { entryPrices[ticker] = getQuote(ticker).price; });

  status.className = 'burn-status pending';
  status.textContent = 'Simulating purchase…';
  await new Promise(r => setTimeout(r, 500));

  const portfolio = {
    id: 'pf_' + Date.now(),
    name,
    createdAt: Date.now(),
    investedAmount: amount,
    holdings: entries.map(([ticker, weight]) => ({ ticker, weight })),
    entryPrices,
    backtest: lastBacktestResult ? {
      range: lastBacktestResult.range,
      totalReturnPct: lastBacktestResult.totalReturnPct,
      benchmarkReturnPct: lastBacktestResult.benchmarkReturnPct
    } : null
  };
  saveSavedPortfoliosList([...loadSavedPortfolios(), portfolio]);

  status.className = 'burn-status success';
  status.textContent = 'Saved. Buy was simulated — no real trade was placed. Redirecting…';

  portfolioSelections = {};
  lastBacktestResult = null;
  setTimeout(() => {
    portfolioViewMode = 'list';
    renderPortfolioView();
  }, 900);
}

/* ---------------- live tick loop ---------------- */
subscribeTick(() => {
  refreshSidebarPrices();
  refreshPriceBlock();
  if (currentTicker && currentTicker === activeIndexTicker().ticker) {
    document.querySelectorAll('.tile').forEach(tile => {
      const ticker = tile.dataset.ticker;
      const q = getQuote(ticker);
      const chg = tile.querySelector('.t-chg');
      if (chg) chg.textContent = fmtPct(q.changePercent);
      tile.style.background = heatColor(q.changePercent);
    });
  }
  if (currentTicker === null && portfolioViewMode === 'list') refreshPortfolioListValues();
});

/* ---------------- init ---------------- */
const _marketNameLabel = document.getElementById('marketNameLabel');
if (_marketNameLabel) _marketNameLabel.textContent = activeMarketName().toUpperCase() + (currentMarket === 'NDX' ? ' · TOKENIZED' : '');
handleHashChange();
