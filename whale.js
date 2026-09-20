/* ============================================================
   QTERMINAL — whale.js
   Real, live on-chain activity for $QUOKKA from Dexscreener's
   free public API (docs.dexscreener.com) — no API key needed.

   WHAT THIS IS: aggregate DEX activity for the token's most
   liquid pair — volume, buy/sell counts, price change, liquidity.
   All real, refreshed every 30s.

   WHAT THIS ISN'T: per-wallet whale detection (flagging that a
   specific address moved a large amount). Dexscreener's public
   API doesn't expose individual transfers, only aggregates. Real
   whale-wallet tracking needs a block-explorer API (Etherscan/
   Basescan/etc, free tier, needs signup + confirming which chain
   $QUOKKA is deployed on) or a paid indexer. See the note in
   wallet.js's header for how to wire that up once you have it.
   ============================================================ */

async function fetchDexscreenerPairs(address) {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${address}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.pairs || null;
  } catch (e) {
    return null;
  }
}

function fmtUsd(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

async function renderWhaleActivity(container) {
  if (!container) return;
  const address = COIN_CONFIG?.contractAddress;
  if (!address) {
    container.innerHTML = `
      <div class="info-card" style="grid-column:1/-1;">
        <h3>$QUOKKA ON-CHAIN ACTIVITY</h3>
        <div class="kv"><span class="k">Status</span><span class="v">No contract address set in coin-config.js</span></div>
      </div>`;
    return;
  }

  const pairs = await fetchDexscreenerPairs(address);
  if (!pairs || pairs.length === 0) {
    container.innerHTML = `
      <div class="info-card" style="grid-column:1/-1;">
        <h3>$QUOKKA ON-CHAIN ACTIVITY</h3>
        <div class="kv"><span class="k">Status</span><span class="v">No DEX pairs found on Dexscreener yet</span></div>
        <div class="kv"><span class="k">Note</span><span class="v" style="font-size:10px;color:var(--text-faint);">
          Will populate automatically once $QUOKKA has an indexed liquidity pool.</span></div>
      </div>`;
    return;
  }

  const pair = [...pairs].sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
  const txns = pair.txns || {};
  const vol = pair.volume || {};
  const chg = pair.priceChange || {};
  const h24 = txns.h24 || {};

  container.innerHTML = `
    <div class="info-card" style="grid-column:1/-1;">
      <h3>$QUOKKA ON-CHAIN ACTIVITY <span style="color:var(--green);">· LIVE, DEXSCREENER</span></h3>
      <div class="kv"><span class="k">Pair</span><span class="v">${pair.baseToken?.symbol || '?'}/${pair.quoteToken?.symbol || '?'} on ${pair.dexId || '?'} (${pair.chainId || '?'})</span></div>
      <div class="kv"><span class="k">Price (USD)</span><span class="v">$${pair.priceUsd ? Number(pair.priceUsd).toFixed(8) : '—'}</span></div>
      <div class="kv"><span class="k">24h change</span><span class="v ${chg.h24 >= 0 ? 'up' : 'down'}">${chg.h24 != null ? fmtPct(chg.h24) : '—'}</span></div>
      <div class="kv"><span class="k">24h volume</span><span class="v">${fmtUsd(vol.h24)}</span></div>
      <div class="kv"><span class="k">24h buys / sells</span><span class="v">${h24.buys ?? '—'} / ${h24.sells ?? '—'}</span></div>
      <div class="kv"><span class="k">Liquidity (USD)</span><span class="v">${fmtUsd(pair.liquidity?.usd)}</span></div>
      <div class="kv"><span class="k">Note</span><span class="v" style="font-size:10px;color:var(--text-faint);">
        Aggregate DEX activity — not per-wallet whale detection (needs a block-explorer API key, see wallet.js)</span></div>
    </div>`;
}

// Poll every 30s while the QQQ (home) page is showing this panel.
let _whaleInterval = null;
function startWhaleActivityPolling(container) {
  stopWhaleActivityPolling();
  renderWhaleActivity(container);
  _whaleInterval = setInterval(() => renderWhaleActivity(container), 30000);
}
function stopWhaleActivityPolling() {
  if (_whaleInterval) { clearInterval(_whaleInterval); _whaleInterval = null; }
}
