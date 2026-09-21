/* ============================================================
   QTERMINAL — globe.js
   Canvas-drawn rotating wireframe globe (no map-data / WebGL
   dependency — just lat/long trig projected orthographically,
   which keeps it self-contained and in the same terminal-pixel
   aesthetic as the rest of the site). Glowing markers mark each
   index's host city; click one to jump to its market page.
   ============================================================ */

const clockEl = document.getElementById('clock');
function tickClock() {
  clockEl.textContent = new Date().toLocaleTimeString('en-US', { hour12: false }) + ' LOCAL';
}
setInterval(tickClock, 1000);
tickClock();

/* ---------------- globe rendering ---------------- */
const canvas = document.getElementById('globeCanvas');
const ctx = canvas.getContext('2d');
const toastEl = document.getElementById('globeToast');

let W, H, R, cx, cy;
function resizeGlobe() {
  const wrap = canvas.parentElement;
  W = canvas.width = wrap.clientWidth;
  H = canvas.height = wrap.clientHeight;
  R = Math.min(W, H) * 0.38;
  cx = W / 2;
  cy = H / 2;
}
resizeGlobe();
window.addEventListener('resize', resizeGlobe);

let rotation = 0;
const TILT = 0.35; // radians, fixed viewing tilt so poles aren't edge-on

function project(latDeg, lonDeg) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180 + rotation;
  let x = Math.cos(lat) * Math.cos(lon);
  let y = Math.sin(lat);
  let z = Math.cos(lat) * Math.sin(lon);
  const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
  const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
  return {
    x: cx + x * R,
    y: cy - y2 * R,
    z: z2,
    depth: (z2 + 1) / 2
  };
}

let markerPositions = [];

function drawGlobe() {
  ctx.clearRect(0, 0, W, H);

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,178,56,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // faint ocean graticule (sparse, just enough to read as a sphere)
  ctx.fillStyle = 'rgba(90,90,90,0.35)';
  for (let lat = -60; lat <= 60; lat += 30) {
    for (let lon = 0; lon < 360; lon += 6) {
      const p = project(lat, lon);
      if (p.z <= 0.05) continue;
      const size = 0.5 + p.depth * 0.8;
      ctx.globalAlpha = 0.15 + p.depth * 0.35;
      ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
    }
  }
  ctx.globalAlpha = 1;

  // real landmass, baked from actual coastline data — this is what
  // makes it read as Earth instead of a blank sphere
  for (let i = 0; i < LAND_DOTS.length; i += 2) {
    const lat = LAND_DOTS[i], lon = LAND_DOTS[i + 1];
    const p = project(lat, lon);
    if (p.z <= 0.02) continue;
    const size = 1.1 + p.depth * 1.6;
    ctx.globalAlpha = 0.35 + p.depth * 0.65;
    ctx.fillStyle = '#ffb238';
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;

  markerPositions = [];
  WORLD_INDEXES.forEach(idx => {
    const p = project(idx.lat, idx.lon);
    markerPositions.push({ idx, p });
    if (p.z <= 0) return;
    const pulse = idx.functional ? 0.6 + 0.4 * Math.sin(Date.now() / 350) : 1;
    const baseColor = idx.functional ? '0,200,5' : '255,178,56';
    const radius = (idx.functional ? 4 : 2.6) * (0.6 + p.depth * 0.6) * pulse;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor},${0.10 * p.depth})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor},${0.55 + 0.45 * p.depth})`;
    ctx.fill();
  });

  rotation += 0.0018;
  requestAnimationFrame(drawGlobe);
}
drawGlobe();

/* ---------------- interaction ---------------- */
function findMarkerAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let closest = null, closestDist = 16;
  markerPositions.forEach(m => {
    if (m.p.z <= 0) return;
    const d = Math.hypot(m.p.x - x, m.p.y - y);
    if (d < closestDist) { closestDist = d; closest = m; }
  });
  return closest;
}

function showToast(text, x, y) {
  toastEl.textContent = text;
  toastEl.style.left = x + 'px';
  toastEl.style.top = y + 'px';
  toastEl.style.opacity = '1';
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toastEl.style.opacity = '0'; }, 1600);
}

canvas.addEventListener('click', (e) => {
  const hit = findMarkerAt(e.clientX, e.clientY);
  if (!hit) return;
  if (hit.idx.functional && hit.idx.route) {
    window.location.href = hit.idx.route;
  } else {
    const rect = canvas.getBoundingClientRect();
    showToast(`${hit.idx.name} — coming soon`, e.clientX - rect.left, e.clientY - rect.top - 24);
  }
});

canvas.addEventListener('mousemove', (e) => {
  const hit = findMarkerAt(e.clientX, e.clientY);
  canvas.style.cursor = hit ? 'pointer' : 'default';
});

/* ---------------- index button grid ---------------- */
function renderIndexGrid() {
  const grid = document.getElementById('indexGrid');
  grid.innerHTML = WORLD_INDEXES.map(idx => `
    <button class="index-btn ${idx.functional ? 'functional' : ''}" data-id="${idx.id}">
      <span class="ib-name">${idx.name}</span>
      <span class="ib-city">${idx.city}, ${idx.country}</span>
    </button>`).join('');

  grid.querySelectorAll('.index-btn').forEach(btn => {
    const idx = WORLD_INDEXES.find(i => i.id === btn.dataset.id);
    btn.addEventListener('click', () => {
      if (idx.functional && idx.route) {
        window.location.href = idx.route;
      } else {
        const rect = btn.getBoundingClientRect();
        showToast(`${idx.name} — coming soon`, rect.left + rect.width / 2, rect.top - 30);
        toastEl.style.position = 'fixed';
        setTimeout(() => { toastEl.style.position = 'absolute'; }, 1700);
      }
    });
  });
}
renderIndexGrid();

/* ---------------- world news feed (real, via Yahoo search) ---------------- */
async function fetchWorldNews() {
  return await fetchYahooNews('world stock markets');
}

async function loadWorldNews() {
  const badge = document.getElementById('newsLiveBadge');
  const list = document.getElementById('worldNewsList');
  const news = await fetchWorldNews();
  if (!news || news.length === 0) {
    if (badge) { badge.textContent = '· DEMO'; badge.style.color = 'var(--text-faint)'; }
    list.innerHTML = [
      'Global indexes mixed as investors weigh rate outlook',
      'Asian markets track overnight moves on Wall Street',
      'European stocks open cautiously ahead of data releases',
      'Currency markets steady as traders await central bank signals'
    ].map(h => `<div class="news-item">${h}<span class="n-time">Demo headline</span></div>`).join('');
    return;
  }
  if (badge) { badge.textContent = '· LIVE'; badge.style.color = 'var(--green)'; }
  list.innerHTML = news.slice(0, 8).map(n => `
    <div class="news-item">
      <a href="${n.link}" target="_blank" rel="noopener" style="color:inherit;">${n.title}</a>
      <span class="n-time">${n.publisher ? n.publisher + ' · ' : ''}${n.providerPublishTime ? new Date(n.providerPublishTime * 1000).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : ''}</span>
    </div>`).join('');
}
loadWorldNews();
setInterval(loadWorldNews, 60000);
