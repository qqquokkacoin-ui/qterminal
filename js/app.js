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
let chartRange = '1D';
let searchFilter = '';

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
  const rest = CONSTITUENTS
    .filter(t => !q || t.ticker.includes(q) || t.name.toUpperCase().includes(q))
    .sort((a, b) => a.ticker.localeCompare(b.ticker));

  const showIndex = !q || INDEX_TICKER.ticker.includes(q) || INDEX_TICKER.name.toUpperCase().includes(q);

  let html = '';
  if (showIndex) {
    html += rowHtml(INDEX_TICKER, true);
    html += `<div class="sidebar-divider">NASDAQ-100 CONSTITUENTS (${rest.length})</div>`;
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
  UNIVERSE.forEach(t => {
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
function onBackgroundSyncComplete() {
  refreshSidebarPrices();
  if (currentTicker === 'QQQ') {
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
  const t = (window.location.hash || '#QQQ').slice(1).toUpperCase();
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
  currentTicker = getTickerData(t) ? t : 'QQQ';
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
  const meta = getTickerData(currentTicker);
  const isIndex = currentTicker === 'QQQ';
  const tokenizedTag = meta.tokenized
    ? `<a class="tag tokenized" href="${ROBINHOOD_TRADE_URL}" target="_blank" rel="noopener" title="Trade on Robinhood">ROBINHOOD TOKENIZED ↗</a>`
    : `<span class="tag">NOT TOKENIZED</span>`;

  mainContentEl.innerHTML = `
    ${isIndex ? heatmapSectionHtml() : ''}
    ${isIndex ? '<div class="info-grid" style="margin-top:0; margin-bottom:18px;"><div id="whaleActivity"><div class="info-card" style="grid-column:1/-1;"><h3>$QUOKKA ON-CHAIN ACTIVITY</h3><div class="kv"><span class="k">Status</span><span class="v">Loading…</span></div></div></div></div>' : ''}
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
        <span class="section-title">PRICE &amp; VOLUME <span id="chartLiveBadge" style="color:var(--text-faint);"></span></span>
        <div class="range-toggle" id="rangeToggle">
          ${['1D', '5D', '1M', '6M', '1Y'].map(r => `<button data-range="${r}" class="${r === chartRange ? 'active' : ''}">${r}</button>`).join('')}
        </div>
      </div>
      <div class="chart-box">
        <canvas id="priceChart" height="260"></canvas>
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
  // load time is ~0ms; the LIVE badge flips over once the real
  // numbers land, usually within a second or two.
  const mockF = getFundamentals(currentTicker);
  document.getElementById('fundamentalsGrid').innerHTML =
    earningsCardHtml({ ...mockF, live: false }) + dividendCardHtml({ ...mockF, live: false }) + analystCardHtml({ ...mockF, live: false });
  document.getElementById('newsGrid').innerHTML = newsCardHtml({ ...mockF, live: false });
  paintChart(document.getElementById('priceChart'), getHistory(currentTicker, chartRange));

  drawChart();
  loadFundamentals(currentTicker);
  if (!isIndex) loadFinancialTrends(currentTicker);
  refreshGatedSections();

  if (isIndex) {
    wireHeatmap();
    startWhaleActivityPolling(document.getElementById('whaleActivity'));
  } else {
    stopWhaleActivityPolling();
  }
  document.getElementById('rangeToggle').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      chartRange = btn.dataset.range;
      renderMain();
    });
  });
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

/* ---------------- chart (price line + volume bars, canvas) ---------------- */
let _lastCandles = null; // kept so resize can redraw without refetching
async function drawChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  const requestedTicker = currentTicker;
  const requestedRange = chartRange;

  // Instant paint already happened synchronously in renderMain() with
  // mock data — this call only needs to upgrade to live once it lands.
  const result = await getHistoryAsync(requestedTicker, requestedRange);
  if (requestedTicker !== currentTicker || requestedRange !== chartRange) return; // stale response

  _lastCandles = result.candles;
  const badge = document.getElementById('chartLiveBadge');
  if (badge) {
    badge.textContent = result.live ? '· LIVE' : '· DEMO DATA';
    badge.style.color = result.live ? 'var(--green)' : 'var(--text-faint)';
  }
  if (result.live) refreshPriceBlock(); // real price just landed — sync the header too
  paintChart(canvas, result.candles);
}

function paintChart(canvas, candles) {
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssHeight = 260;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const volumes = candles.map(c => c.volume);
  const minP = Math.min(...candles.map(c => c.low));
  const maxP = Math.max(...candles.map(c => c.high));
  const maxV = Math.max(...volumes);

  const padL = 46, padR = 8, padT = 8, volH = 50, gapH = 6;
  const priceAreaH = cssHeight - padT - volH - gapH - 18;
  const chartW = cssWidth - padL - padR;

  const up = candles[candles.length - 1].close >= candles[0].open;
  const lineColor = up ? '#00c805' : '#ff4136';

  // gridlines + price labels
  ctx.strokeStyle = '#1a1a1a';
  ctx.fillStyle = '#5a5a5a';
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) {
    const y = padT + (priceAreaH * i) / 4;
    const val = maxP - ((maxP - minP) * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(cssWidth - padR, y);
    ctx.stroke();
    ctx.fillText(val.toFixed(1), padL - 6, y + 3);
  }

  // price line
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 1.5;
  candles.forEach((c, i) => {
    const x = padL + (chartW * i) / (candles.length - 1);
    const y = padT + priceAreaH - ((c.close - minP) / (maxP - minP || 1)) * priceAreaH;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // fill under line
  const grad = ctx.createLinearGradient(0, padT, 0, padT + priceAreaH);
  grad.addColorStop(0, up ? 'rgba(0,200,5,0.18)' : 'rgba(255,65,54,0.18)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.lineTo(padL + chartW, padT + priceAreaH);
  ctx.lineTo(padL, padT + priceAreaH);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  // volume bars
  const volTop = padT + priceAreaH + gapH;
  const barW = Math.max(1, (chartW / candles.length) * 0.6);
  candles.forEach((c, i) => {
    const x = padL + (chartW * i) / (candles.length - 1);
    const bh = (c.volume / (maxV || 1)) * volH;
    ctx.fillStyle = c.close >= c.open ? 'rgba(0,200,5,0.5)' : 'rgba(255,65,54,0.5)';
    ctx.fillRect(x - barW / 2, volTop + volH - bh, barW, bh);
  });

  ctx.fillStyle = '#5a5a5a';
  ctx.textAlign = 'left';
  ctx.fillText('VOL', padL, volTop - 2);
}
window.addEventListener('resize', () => {
  const canvas = document.getElementById('priceChart');
  if (canvas && _lastCandles) paintChart(canvas, _lastCandles);
});

/* ---------------- heatmap ---------------- */
function heatmapSectionHtml() {
  return `
    <div class="heatmap-section">
      <div class="heatmap-toolbar">
        <span class="section-title">NASDAQ-100 HEATMAP · BY SECTOR</span>
        <div class="size-toggle" id="sizeToggle">
          <button data-mode="equal" class="${heatmapMode === 'equal' ? 'active' : ''}">EQUAL SIZE</button>
          <button data-mode="cap" class="${heatmapMode === 'cap' ? 'active' : ''}">BY MARKET CAP</button>
        </div>
      </div>
      <div class="heatmap-box" id="heatmapBox">
        ${getSectors().map(sectorHtml).join('')}
      </div>
    </div>`;
}

function sectorHtml(sector) {
  const stocks = CONSTITUENTS.filter(s => s.sector === sector);
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
  const meta = getTickerData(ticker);
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

/* ---------------- custom portfolio builder (SHELL — see note below) ---------------- */
// IMPORTANT: "BUY" here is a simulation only. Actually executing a
// purchase needs a real brokerage/exchange backend wired to a funded
// account, which doesn't exist yet — Robinhood has no public trading
// API for this, so "buy" can't be made real until there's an actual
// execution venue to send the order to. This builds the full picker/
// weighting UI now so the moment a real venue exists, only the
// submitPortfolioBuy() function needs replacing with a real order call.
let portfolioSelections = {}; // ticker -> weight (%)

function renderPortfolioView() {
  const tokenized = CONSTITUENTS.filter(s => s.tokenized);
  mainContentEl.innerHTML = `
    <div class="ticker-header">
      <div class="ticker-id">
        <span class="sym">CUSTOM PORTFOLIO</span>
        <span class="nm">Pick tokenized stocks and weightings</span>
        <span class="tag" style="border-color:var(--amber-dim); color:var(--amber-dim);">SIMULATION — NO REAL TRADES</span>
      </div>
    </div>

    <div class="chart-box" style="margin-bottom:16px;">
      <div class="kv"><span class="k">Amount to invest</span><span class="v">
        <input type="number" id="pfAmount" value="1000" min="0" class="wallet-input" style="width:140px; display:inline-block; margin:0;"> USD
      </span></div>
      <div class="kv"><span class="k">Total weight allocated</span><span class="v" id="pfTotalWeight">0%</span></div>
    </div>

    <div class="heatmap-box" style="margin-bottom:16px; max-height:360px; overflow-y:auto;">
      ${tokenized.map(s => portfolioRowHtml(s)).join('')}
    </div>

    <div class="info-card" id="pfSummary" style="grid-column:1/-1; margin-bottom:16px;">
      <h3>ALLOCATION PREVIEW</h3>
      <div class="kv"><span class="k">Status</span><span class="v">Select stocks and set weights above</span></div>
    </div>

    <button class="enter-btn" id="pfBuyBtn" style="letter-spacing:0.15em;">BUILD &amp; BUY PORTFOLIO (SIMULATED)</button>
    <div id="pfBuyStatus" class="burn-status"></div>
  `;

  document.querySelectorAll('.pf-weight-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const ticker = inp.dataset.ticker;
      const val = parseFloat(inp.value) || 0;
      if (val > 0) portfolioSelections[ticker] = val;
      else delete portfolioSelections[ticker];
      updatePortfolioPreview();
    });
  });
  document.getElementById('pfAmount').addEventListener('input', updatePortfolioPreview);
  document.getElementById('pfBuyBtn').addEventListener('click', submitPortfolioBuy);
  updatePortfolioPreview();
}

function portfolioRowHtml(s) {
  return `
    <div class="row" style="cursor:default;">
      <div class="row-left">
        <span class="tok-dot tokenized"></span>
        <div>
          <div class="row-ticker">${s.ticker}</div>
          <div class="row-name">${s.name}</div>
        </div>
      </div>
      <div class="row-right" style="display:flex; align-items:center; gap:6px;">
        <input type="number" min="0" max="100" step="1" placeholder="0"
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

async function submitPortfolioBuy() {
  const status = document.getElementById('pfBuyStatus');
  const totalWeight = Object.values(portfolioSelections).reduce((a, b) => a + b, 0);
  const entries = Object.entries(portfolioSelections);

  if (entries.length === 0) {
    status.className = 'burn-status error';
    status.textContent = 'Pick at least one stock and set a weight.';
    return;
  }
  if (Math.abs(totalWeight - 100) > 0.5) {
    status.className = 'burn-status error';
    status.textContent = `Weights must total 100% (currently ${totalWeight.toFixed(0)}%).`;
    return;
  }

  // No real execution venue exists yet — this is where a real broker/
  // DEX order call goes once one does. For now it's an honest no-op
  // that shows exactly what WOULD have been bought.
  status.className = 'burn-status pending';
  status.textContent = 'Simulating order…';
  await new Promise(r => setTimeout(r, 600));
  status.className = 'burn-status success';
  status.textContent = `Simulated only — no real trade was placed. ${entries.length} position(s) would have been bought at current prices.`;
}

/* ---------------- live tick loop ---------------- */
subscribeTick(() => {
  refreshSidebarPrices();
  refreshPriceBlock();
  if (currentTicker === 'QQQ') {
    document.querySelectorAll('.tile').forEach(tile => {
      const ticker = tile.dataset.ticker;
      const q = getQuote(ticker);
      const chg = tile.querySelector('.t-chg');
      if (chg) chg.textContent = fmtPct(q.changePercent);
      tile.style.background = heatColor(q.changePercent);
    });
  }
});

/* ---------------- init ---------------- */
handleHashChange();
