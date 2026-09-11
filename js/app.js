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

/* ---------------- routing ---------------- */
function navigateTo(ticker) {
  window.location.hash = ticker;
}
function handleHashChange() {
  const t = (window.location.hash || '#QQQ').slice(1).toUpperCase();
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
  mainContentEl.innerHTML = `
    ${isIndex ? heatmapSectionHtml() : ''}
    <div class="ticker-header">
      <div class="ticker-id">
        <span class="sym">${meta.ticker}</span>
        <span class="nm">${meta.name}</span>
        <span class="tag ${meta.tokenized ? 'tokenized' : ''}">${meta.tokenized ? 'ROBINHOOD TOKENIZED' : 'NOT TOKENIZED'}</span>
      </div>
      <div class="price-block" id="priceBlock"></div>
    </div>

    <div class="chart-section">
      <div class="chart-toolbar">
        <span class="section-title">PRICE &amp; VOLUME</span>
        <div class="range-toggle" id="rangeToggle">
          ${['1D', '5D', '1M', '6M', '1Y'].map(r => `<button data-range="${r}" class="${r === chartRange ? 'active' : ''}">${r}</button>`).join('')}
        </div>
      </div>
      <div class="chart-box">
        <canvas id="priceChart" height="260"></canvas>
      </div>
    </div>

    <div class="info-grid">
      ${earningsCardHtml(meta)}
      ${dividendCardHtml(meta)}
      ${analystCardHtml(meta)}
    </div>
    <div class="info-grid" style="margin-top:12px;">
      ${newsCardHtml(meta)}
    </div>
    <div class="info-grid" style="margin-top:12px;">
      <div id="premiumGate"></div>
    </div>
  `;

  refreshPriceBlock();
  drawChart();
  refreshGatedSections();

  if (isIndex) {
    wireHeatmap();
  }
  document.getElementById('rangeToggle').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      chartRange = btn.dataset.range;
      renderMain();
    });
  });
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

function earningsCardHtml(meta) {
  const f = getFundamentals(meta.ticker);
  return `
    <div class="info-card">
      <h3>EARNINGS</h3>
      <div class="kv"><span class="k">Next report</span><span class="v">${fmtDate(f.earnings.date)}</span></div>
      <div class="kv"><span class="k">EPS estimate</span><span class="v">$${f.earnings.epsEstimate.toFixed(2)}</span></div>
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

function dividendCardHtml(meta) {
  const f = getFundamentals(meta.ticker);
  if (!f.dividend) {
    return `<div class="info-card"><h3>DIVIDENDS</h3><div class="kv"><span class="k">Status</span><span class="v">No dividend</span></div></div>`;
  }
  const d = f.dividend;
  return `
    <div class="info-card">
      <h3>DIVIDENDS</h3>
      <div class="kv"><span class="k">Yield</span><span class="v">${d.yieldPct.toFixed(2)}%</span></div>
      <div class="kv"><span class="k">Per share</span><span class="v">$${d.perShare.toFixed(2)}</span></div>
      <div class="kv"><span class="k">Ex-div date</span><span class="v">${fmtDate(d.exDivDate)}</span></div>
      <div style="margin-top:8px;">
        ${d.history.map(h => `<div class="eps-row"><span>${h.quarter}</span><span>$${h.amount.toFixed(2)}</span></div>`).join('')}
      </div>
    </div>`;
}

function analystCardHtml(meta) {
  const f = getFundamentals(meta.ticker);
  const a = f.analyst;
  const q = getQuote(meta.ticker);
  const upside = ((a.targetPrice - q.price) / q.price) * 100;
  return `
    <div class="info-card">
      <h3>ANALYST EXPECTATIONS</h3>
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

function newsCardHtml(meta) {
  const f = getFundamentals(meta.ticker);
  return `
    <div class="info-card" style="grid-column: 1 / -1;">
      <h3>NEWS</h3>
      ${f.news.map(n => `
        <div class="news-item">
          ${n.headline}
          <span class="n-time">${n.time.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
        </div>`).join('')}
    </div>`;
}

/* ---------------- chart (price line + volume bars, canvas) ---------------- */
function drawChart() {
  const canvas = document.getElementById('priceChart');
  if (!canvas) return;
  const dpr = window.devicePixelRatio || 1;
  const cssWidth = canvas.clientWidth || canvas.parentElement.clientWidth;
  const cssHeight = 260;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  canvas.style.height = cssHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const candles = getHistory(currentTicker, chartRange);
  const prices = candles.map(c => c.close);
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
  ctx.fillStyle = '#3a3a3a';
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
window.addEventListener('resize', () => drawChart());

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
  const dims = tileDims(s.marketCapB);
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
