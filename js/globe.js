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

/* ---------------- background starfield (same as landing page) ---------------- */
(function () {
  const bgCanvas = document.getElementById('bgStarfield');
  const bgCtx = bgCanvas.getContext('2d');
  let bw, bh;
  function resizeBg() {
    bw = bgCanvas.width = window.innerWidth;
    bh = bgCanvas.height = window.innerHeight;
  }
  resizeBg();
  window.addEventListener('resize', resizeBg);

  const STAR_COUNT = 110;
  const stars = Array.from({ length: STAR_COUNT }, () => ({
    x: Math.random() * bw,
    y: Math.random() * bh,
    size: Math.random() < 0.15 ? 2 : 1,
    phase: Math.random() * Math.PI * 2,
    speed: 0.5 + Math.random() * 1.2
  }));

  let shootingStars = [];
  function spawnShootingStar() {
    shootingStars.push({
      x: Math.random() * bw * 0.7,
      y: Math.random() * bh * 0.4,
      len: 40 + Math.random() * 60,
      speed: 6 + Math.random() * 5,
      angle: Math.PI / 5,
      life: 1
    });
  }
  setInterval(() => { if (Math.random() < 0.5) spawnShootingStar(); }, 2200);

  let t = 0;
  function drawBg() {
    t += 0.02;
    bgCtx.clearRect(0, 0, bw, bh);
    bgCtx.fillStyle = '#000';
    bgCtx.fillRect(0, 0, bw, bh);

    for (const s of stars) {
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(t * s.speed + s.phase));
      bgCtx.fillStyle = `rgba(255,255,255,${twinkle.toFixed(2)})`;
      bgCtx.fillRect(Math.floor(s.x), Math.floor(s.y), s.size, s.size);
    }

    shootingStars.forEach(st => {
      st.x += Math.cos(st.angle) * st.speed;
      st.y += Math.sin(st.angle) * st.speed;
      st.life -= 0.02;
      if (st.life > 0) {
        const tailX = st.x - Math.cos(st.angle) * st.len;
        const tailY = st.y - Math.sin(st.angle) * st.len;
        const grad = bgCtx.createLinearGradient(st.x, st.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,178,56,${st.life})`);
        grad.addColorStop(1, 'rgba(255,178,56,0)');
        bgCtx.strokeStyle = grad;
        bgCtx.lineWidth = 2;
        bgCtx.beginPath();
        bgCtx.moveTo(st.x, st.y);
        bgCtx.lineTo(tailX, tailY);
        bgCtx.stroke();
      }
    });
    shootingStars = shootingStars.filter(st => st.life > 0 && st.y < bh + 50);

    requestAnimationFrame(drawBg);
  }
  drawBg();
})();

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
const TILT = 0.15; // radians — smaller = camera sits closer to the equatorial plane

// Generic projection so both the Earth and the orbiting Moon can
// share the same lat/lon -> screen math, just with their own
// center/radius/rotation/tilt.
function projectOnSphere(latDeg, lonDeg, ccx, ccy, radius, rot, tilt) {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180 + rot;
  let x = Math.cos(lat) * Math.cos(lon);
  let y = Math.sin(lat);
  let z = Math.cos(lat) * Math.sin(lon);
  const y2 = y * Math.cos(tilt) - z * Math.sin(tilt);
  const z2 = y * Math.sin(tilt) + z * Math.cos(tilt);
  return {
    x: ccx - x * radius, // negated: without this, east/west render mirrored
    y: ccy - y2 * radius,
    z: z2,
    depth: (z2 + 1) / 2
  };
}
function project(latDeg, lonDeg) {
  return projectOnSphere(latDeg, lonDeg, cx, cy, R, rotation, TILT);
}

/* ---------------- crypto moon: orbits the globe, has its own markers ---------------- */
let moonAngle = 0;
let moonRotation = 0;
const MOON_ORBIT_RX_FACTOR = 2.1;
const MOON_ORBIT_RY_FACTOR = 0.5;
const MOON_RADIUS_FACTOR = 0.22;
const MOON_TILT = 0.15;

const MOON_MARKERS = [
  { id: 'BTC', name: 'Bitcoin', lat: 15, lon: 40 },
  { id: 'ETH', name: 'Ethereum', lat: -10, lon: 170 },
  { id: 'SOL', name: 'Solana', lat: 25, lon: -110 }
];
// Sparse crater texture — static, generated once.
const MOON_CRATERS = Array.from({ length: 90 }, () => ({
  lat: (Math.random() - 0.5) * 170,
  lon: Math.random() * 360
}));

function moonState() {
  const orbitRX = R * MOON_ORBIT_RX_FACTOR;
  const orbitRY = R * MOON_ORBIT_RY_FACTOR;
  return {
    cx: cx + Math.cos(moonAngle) * orbitRX,
    cy: cy + Math.sin(moonAngle) * orbitRY,
    r: R * MOON_RADIUS_FACTOR,
    depth: Math.sin(moonAngle) // >0 = in front of Earth, <0 = behind
  };
}

let moonMarkerPositions = [];
function drawMoon() {
  const m = moonState();
  const mproj = (lat, lon) => projectOnSphere(lat, lon, m.cx, m.cy, m.r, moonRotation, MOON_TILT);

  // Solid body: an opaque fill is what hides the moon when it passes
  // behind the Earth (and hides the Earth when the moon passes in front).
  ctx.beginPath();
  ctx.arc(m.cx, m.cy, m.r, 0, Math.PI * 2);
  ctx.fillStyle = '#0d0d0d';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  MOON_CRATERS.forEach(c => {
    const p = mproj(c.lat, c.lon);
    if (p.z <= 0.05) return;
    const size = 0.8 + p.depth * 1.3;
    ctx.globalAlpha = 0.2 + p.depth * 0.4;
    ctx.fillStyle = '#b8b8b8';
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  });
  ctx.globalAlpha = 1;

  moonMarkerPositions = [];
  MOON_MARKERS.forEach(mk => {
    const p = mproj(mk.lat, mk.lon);
    moonMarkerPositions.push({ idx: { name: mk.name, functional: true, route: `crypto.html#${mk.id}` }, p });
    if (p.z <= 0) return;
    const pulse = 0.6 + 0.4 * Math.sin(Date.now() / 350);
    const radius = 3.2 * (0.6 + p.depth * 0.6) * pulse;
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 2.2, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(94,198,255,${0.12 * p.depth})`;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(94,198,255,${0.6 + 0.4 * p.depth})`;
    ctx.fill();
  });

  const now = Date.now();
  moonNewsBlips = moonNewsBlips.filter(b => now - b.start < BLIP_LIFETIME);
  moonNewsBlips.forEach(b => {
    const p = mproj(b.lat, b.lon);
    if (p.z <= 0) return;
    const age = (now - b.start) / BLIP_LIFETIME;
    const ringR = (2.5 + age * 12) * (0.6 + p.depth * 0.6);
    const alpha = (1 - age) * 0.8 * (0.4 + p.depth * 0.6);
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,65,54,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 2 * (0.6 + p.depth * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,65,54,${0.5 + p.depth * 0.5})`;
    ctx.fill();
  });

  moonAngle += 0.0011;
  moonRotation += 0.002;
}

let markerPositions = [];
let newsBlips = []; // { lat, lon, start } — Earth
let moonNewsBlips = []; // { lat, lon, start } — Moon (crypto news)
const BLIP_LIFETIME = 5000; // ms a red ping stays visible after a headline is geolocated

function drawGlobe() {
  ctx.clearRect(0, 0, W, H);

  const moonBehind = moonState().depth < 0;
  if (moonBehind) drawMoon();
  drawEarth();
  if (!moonBehind) drawMoon();

  rotation += 0.0018;
  requestAnimationFrame(drawGlobe);
}

function drawEarth() {
  // Solid body (opaque fill) so nothing behind it shows through.
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fillStyle = '#050505';
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
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
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
  }
  ctx.globalAlpha = 1;

  markerPositions = [];
  WORLD_INDEXES.forEach(idx => {
    const p = project(idx.lat, idx.lon);
    markerPositions.push({ idx, p });
    if (p.z <= 0) return;
    const pulse = idx.tokenized ? 0.6 + 0.4 * Math.sin(Date.now() / 350) : 1;
    const baseColor = idx.tokenized ? '0,200,5' : '94,198,255'; // green vs light blue
    const radius = (idx.tokenized ? 4 : 2.6) * (0.6 + p.depth * 0.6) * pulse;

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius * 2.4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor},${0.10 * p.depth})`;
    ctx.fill();

    ctx.beginPath();
    ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${baseColor},${0.55 + 0.45 * p.depth})`;
    ctx.fill();
  });

  // news blips — red radar-ping markers at geolocated headlines
  const now = Date.now();
  newsBlips = newsBlips.filter(b => now - b.start < BLIP_LIFETIME);
  newsBlips.forEach(b => {
    const p = project(b.lat, b.lon);
    if (p.z <= 0) return;
    const age = (now - b.start) / BLIP_LIFETIME; // 0..1
    const ringR = (3 + age * 16) * (0.6 + p.depth * 0.6);
    const alpha = (1 - age) * 0.8 * (0.4 + p.depth * 0.6);
    ctx.beginPath();
    ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,65,54,${alpha})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(p.x, p.y, 2.5 * (0.6 + p.depth * 0.6), 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,65,54,${0.5 + p.depth * 0.5})`;
    ctx.fill();
  });
}
drawGlobe();

/* ---------------- interaction ---------------- */
function findMarkerAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = clientX - rect.left;
  const y = clientY - rect.top;
  let closest = null, closestDist = 16;
  [...markerPositions, ...moonMarkerPositions].forEach(m => {
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
    <button class="index-btn ${idx.functional ? 'functional' : ''} ${idx.tokenized ? 'tokenized' : 'not-tokenized'}" data-id="${idx.id}">
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

/* ---------------- world news feed (real, via Marketaux) ---------------- */
// Marketaux gives real per-article entity data (country, exchange),
// so blips use that directly now instead of guessing from keywords —
// far more accurate. A rough country-centroid lookup still fills in
// the lat/lon for whatever country the entity data names.
const COUNTRY_CENTROIDS = {
  us: { lat: 39.8, lon: -98.5 }, gb: { lat: 54.0, lon: -2.0 }, cn: { lat: 35.0, lon: 103.0 },
  jp: { lat: 36.2, lon: 138.3 }, de: { lat: 51.2, lon: 10.4 }, fr: { lat: 46.6, lon: 2.2 },
  in: { lat: 22.0, lon: 79.0 }, au: { lat: -25.3, lon: 133.8 }, ca: { lat: 56.1, lon: -106.3 },
  br: { lat: -14.2, lon: -51.9 }, kr: { lat: 36.5, lon: 127.8 }, hk: { lat: 22.3, lon: 114.2 },
  sg: { lat: 1.35, lon: 103.8 }, tw: { lat: 23.7, lon: 121.0 }, ch: { lat: 46.8, lon: 8.2 },
  es: { lat: 40.5, lon: -3.7 }, it: { lat: 42.5, lon: 12.6 }
};

async function fetchWorldNews() {
  const data = await fetchMarketauxNews({
    countries: Object.keys(COUNTRY_CENTROIDS).join(','),
    limit: 10
  });
  return data;
}

async function loadWorldNews() {
  const badge = document.getElementById('newsLiveBadge');
  const list = document.getElementById('worldNewsList');
  const articles = await fetchWorldNews();

  if (!articles || articles.length === 0) {
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
  list.innerHTML = articles.slice(0, 8).map(a => `
    <div class="news-item">
      <a href="${a.url}" target="_blank" rel="noopener" style="color:inherit;">${a.title}</a>
      <span class="n-time">${a.source ? a.source + ' · ' : ''}${a.published_at ? new Date(a.published_at).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }) : ''}</span>
    </div>`).join('');

  // real geolocation from each article's entities, not a keyword guess
  const now = Date.now();
  articles.slice(0, 8).forEach((a, i) => {
    const entityCountry = a.entities?.find(e => e.country && COUNTRY_CENTROIDS[e.country.toLowerCase()])?.country?.toLowerCase();
    const loc = entityCountry ? COUNTRY_CENTROIDS[entityCountry] : null;
    if (loc) newsBlips.push({ lat: loc.lat, lon: loc.lon, start: now + i * 250 });
  });
}
loadWorldNews();
setInterval(loadWorldNews, 180000); // Marketaux free-tier quota is limited — poll every 3 min, not 1

/* ---------------- crypto news feed (real, CryptoCompare) — pings the Moon ---------------- */
async function fetchCryptoNewsForGlobe() {
  try {
    const res = await fetch('https://min-api.cryptocompare.com/data/v2/news/?lang=EN', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.Data || null;
  } catch (e) { return null; }
}

function guessMoonMarkerFor(headline) {
  const h = headline.toUpperCase();
  if (h.includes('BITCOIN') || h.includes('BTC')) return MOON_MARKERS[0];
  if (h.includes('ETHEREUM') || h.includes(' ETH ') || h.includes('ETH,') || h.includes('ETH.')) return MOON_MARKERS[1];
  if (h.includes('SOLANA') || h.includes(' SOL ') || h.includes('SOL,') || h.includes('SOL.')) return MOON_MARKERS[2];
  return null;
}

async function loadCryptoNewsGlobe() {
  const badge = document.getElementById('cryptoNewsLiveBadge');
  const list = document.getElementById('cryptoNewsList');
  const news = await fetchCryptoNewsForGlobe();
  if (!news || news.length === 0) {
    if (badge) { badge.textContent = '· DEMO'; badge.style.color = 'var(--text-faint)'; }
    if (list) list.innerHTML = [
      'Bitcoin holds range as traders await macro catalysts',
      'Ethereum network activity ticks up on L2 usage',
      'Solana ecosystem sees fresh developer activity',
      'Stablecoin flows steady across major exchanges'
    ].map(h => `<div class="news-item">${h}<span class="n-time">Demo headline</span></div>`).join('');
    return;
  }
  if (badge) { badge.textContent = '· LIVE'; badge.style.color = 'var(--green)'; }
  if (list) list.innerHTML = news.slice(0, 8).map(n => `
    <div class="news-item">
      <a href="${n.url}" target="_blank" rel="noopener" style="color:inherit;">${n.title}</a>
      <span class="n-time">${n.source_info?.name || n.source || ''} · ${new Date(n.published_on * 1000).toLocaleString('en-US', { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</span>
    </div>`).join('');

  const now = Date.now();
  news.slice(0, 8).forEach((n, i) => {
    const marker = guessMoonMarkerFor(n.title || '');
    const loc = marker || MOON_MARKERS[Math.floor(Math.random() * MOON_MARKERS.length)];
    moonNewsBlips.push({ lat: loc.lat, lon: loc.lon, start: now + i * 250 });
  });
}
loadCryptoNewsGlobe();
setInterval(loadCryptoNewsGlobe, 180000);
