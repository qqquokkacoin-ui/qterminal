/* ============================================================
   QTERMINAL — wallet.js
   Wallet login + token-gated features, PLUS the new hold-to-earn
   model: connect a wallet, hold $QTRM, unlock premium features,
   and pick which tokenized stock you'd like rewards paid in.

   WHAT'S REAL RIGHT NOW:
   - Wallet connection: real EIP-1193 (MetaMask, Rabby, Coinbase
     Wallet extension, etc).
   - The holding check (checkAccess): real. It's a single eth_call
     to the token contract's balanceOf(address) — no indexer, no
     backend, just a direct on-chain read. The moment
     COIN_CONFIG.contractAddress is set to $QTRM's real address,
     this starts working for real, no other code changes needed.

   WHAT'S STILL A STUB, AND WHY:
   - The reward-asset preference picker below just saves your
     choice to this browser's localStorage. Actually paying rewards
     needs infrastructure that doesn't exist yet — a snapshot of
     every holder's balance, a treasury of (or a way to swap into)
     each requested Stock Token, and something that executes the
     payouts. That's genuinely a backend job, not something a
     static site can do alone — see the note below for what to
     build first.

   BUILDING THE REAL REWARD SYSTEM — WHAT IT NEEDS:
   1. Deploy $QTRM as an ERC-20 on the same chain the Stock Tokens
      settle on, so a treasury can swap into them directly. As of
      this being written that's Robinhood Chain (Robinhood's own
      Arbitrum-stack L2, mainnet since July 2026) — Uniswap and
      Chainlink are integrated on it from day one, which is exactly
      what a "swap treasury funds into whatever stock the holder
      picked" flow needs. Confirm the current settlement venue
      before deploying; this has shifted before.
   2. A preference registry: instead of (or in addition to) the
      localStorage version here, an on-chain "setRewardPreference"
      contract call is worth considering — it's simple, and means
      the preference lives with the wallet instead of one browser.
   3. A snapshot/indexing job: something that periodically reads
      every holder's $QTRM balance (via RPC) to calculate who gets
      what. This is the piece that actually needs a server — even
      a small scheduled function, since a static site can't run on
      a timer.
   4. The payout itself: either the treasury pushes each reward as
      a direct transfer (simpler for holders, project pays the gas
      — plausible given Robinhood's own gas subsidies on its chain),
      or holders claim via a Merkle-drop contract (more gas-
      efficient at scale, slightly more UX friction).
   ============================================================ */

const WALLET_CONFIG = {
  tokenContractAddress: COIN_CONFIG.contractAddress,
  tokenDecimals: 18, // placeholder — confirm against the real $QTRM contract once deployed
  requiredHoldAmount: 10000, // placeholder — update once tokenomics are decided
  // Flip true to preview gated content as "unlocked" without a real wallet/balance.
  DEV_FORCE_UNLOCKED: false
};

const walletState = {
  address: null,
  connected: false
};

/* ---------------- connection ---------------- */
function shortAddr(addr) {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

async function connectWallet() {
  if (typeof window.ethereum === 'undefined') {
    openWalletModal({ noProvider: true });
    return;
  }
  try {
    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    if (accounts && accounts.length > 0) {
      walletState.address = accounts[0];
      walletState.connected = true;
      localStorage.setItem('qterminal_wallet', accounts[0]);
      renderWalletButton();
      renderGatedContent();
    }
  } catch (e) {
    console.warn('Wallet connection rejected or failed', e);
  }
}

function disconnectWallet() {
  // Note: dapps can't force-disconnect a browser wallet extension,
  // this just clears the app's own "remembered" connection.
  walletState.address = null;
  walletState.connected = false;
  localStorage.removeItem('qterminal_wallet');
  renderWalletButton();
  renderGatedContent();
  closeWalletModal();
}

function tryRestoreWallet() {
  const saved = localStorage.getItem('qterminal_wallet');
  if (saved && window.ethereum) {
    window.ethereum.request({ method: 'eth_accounts' }).then(accounts => {
      if (accounts && accounts.includes(saved)) {
        walletState.address = saved;
        walletState.connected = true;
        renderWalletButton();
        renderGatedContent();
      }
    }).catch(() => {});
  }
}

if (typeof window !== 'undefined' && window.ethereum) {
  window.ethereum.on?.('accountsChanged', (accounts) => {
    if (!accounts || accounts.length === 0) {
      disconnectWallet();
    } else {
      walletState.address = accounts[0];
      walletState.connected = true;
      localStorage.setItem('qterminal_wallet', accounts[0]);
      renderWalletButton();
      renderGatedContent();
    }
  });
}

/* ---------------- holding check (REAL — direct on-chain read) ---------------- */
// balanceOf(address) selector — standard ERC-20, works on any token.
function encodeErc20BalanceOf(address) {
  const selector = "70a08231";
  const addrPadded = address.replace(/^0x/, "").toLowerCase().padStart(64, "0");
  return "0x" + selector + addrPadded;
}

async function getTokenBalance(address) {
  if (!WALLET_CONFIG.tokenContractAddress) return null;
  try {
    const data = encodeErc20BalanceOf(address);
    const result = await window.ethereum.request({
      method: "eth_call",
      params: [{ to: WALLET_CONFIG.tokenContractAddress, data }, "latest"]
    });
    const raw = BigInt(result);
    // Number() loses precision at very large token-unit values, but
    // is accurate enough for display/threshold checks at realistic
    // balance sizes.
    return Number(raw) / Math.pow(10, WALLET_CONFIG.tokenDecimals);
  } catch (e) {
    return null;
  }
}

async function checkAccess() {
  if (WALLET_CONFIG.DEV_FORCE_UNLOCKED) {
    return { hasAccess: true, balance: WALLET_CONFIG.requiredHoldAmount, dev: true };
  }
  if (!walletState.connected) return { hasAccess: false, balance: 0 };
  if (!WALLET_CONFIG.tokenContractAddress) return { hasAccess: false, balance: 0, notDeployed: true };
  const balance = await getTokenBalance(walletState.address);
  if (balance == null) return { hasAccess: false, balance: 0 };
  return { hasAccess: balance >= WALLET_CONFIG.requiredHoldAmount, balance };
}

/* ---------------- reward-asset preference (SHELL — see file header) ---------------- */
const REWARD_PREF_PREFIX = 'qterminal_reward_pref_';
function getRewardPreference(address) {
  try { return localStorage.getItem(REWARD_PREF_PREFIX + address.toLowerCase()) || ''; } catch (e) { return ''; }
}
function setRewardPreference(address, ticker) {
  try { localStorage.setItem(REWARD_PREF_PREFIX + address.toLowerCase(), ticker); } catch (e) { /* unavailable */ }
}

/* ---------------- UI: topbar button + modal ---------------- */
function renderWalletButton() {
  const btn = document.getElementById('walletBtn');
  if (!btn) return;
  if (walletState.connected) {
    btn.className = 'wallet-btn connected';
    btn.innerHTML = `<span class="w-dot"></span> ${shortAddr(walletState.address)}`;
  } else {
    btn.className = 'wallet-btn';
    btn.innerHTML = `<span class="w-dot"></span> CONNECT WALLET`;
  }
}

function rewardAssetOptionsHtml(selected) {
  if (typeof CONSTITUENTS === 'undefined') return '';
  return CONSTITUENTS.filter(s => s.tokenized).map(s =>
    `<option value="${s.ticker}" ${s.ticker === selected ? 'selected' : ''}>${s.ticker} — ${s.name}</option>`
  ).join('');
}

function openWalletModal(opts = {}) {
  let backdrop = document.getElementById('walletModalBackdrop');
  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'walletModalBackdrop';
    backdrop.className = 'wallet-modal-backdrop';
    document.body.appendChild(backdrop);
  }
  if (opts.noProvider) {
    backdrop.innerHTML = `
      <div class="wallet-modal">
        <h2>NO WALLET FOUND</h2>
        <div class="wm-sub">Install a browser wallet extension (MetaMask, Rabby, Coinbase Wallet) to connect.</div>
        <button class="wallet-modal-close" id="walletModalClose">CLOSE</button>
      </div>`;
  } else if (walletState.connected) {
    const currentPref = getRewardPreference(walletState.address);
    backdrop.innerHTML = `
      <div class="wallet-modal">
        <h2>WALLET CONNECTED</h2>
        <div class="wm-sub">${walletState.address}</div>
        <div class="wallet-status-row"><span class="k">$QTRM held</span><span class="v" id="wmBalance">checking…</span></div>
        <div class="wallet-status-row"><span class="k">Required for premium</span><span class="v">${WALLET_CONFIG.requiredHoldAmount.toLocaleString()}</span></div>

        <div style="margin-top:14px; font-size:10px; letter-spacing:0.1em; color:var(--text-dim);">PREFERRED REWARD ASSET</div>
        <div class="wm-sub" style="margin-bottom:8px;">Which tokenized stock you'd like reward payouts in, once the reward system is live.</div>
        <select id="rewardAssetSelect" class="wallet-input">
          <option value="">— not set —</option>
          ${rewardAssetOptionsHtml(currentPref)}
        </select>
        <div id="rewardPrefStatus" class="burn-status"></div>

        <button class="wallet-disconnect" id="walletDisconnectBtn">DISCONNECT</button>
        <button class="wallet-modal-close" id="walletModalClose">CLOSE</button>
      </div>`;
    checkAccess().then(res => {
      const el = document.getElementById('wmBalance');
      if (!el) return;
      if (res.notDeployed) { el.textContent = '— $QTRM not deployed yet —'; return; }
      el.textContent = res.balance.toLocaleString() + (res.hasAccess ? ' — UNLOCKED' : '');
    });
  } else {
    backdrop.innerHTML = `
      <div class="wallet-modal">
        <h2>CONNECT WALLET</h2>
        <div class="wm-sub">Connect to check your $QTRM holdings and unlock premium features.</div>
        <div class="wallet-option" id="walletConnectOption">
          <span>Browser wallet (MetaMask / Rabby / etc.)</span><span>→</span>
        </div>
        <button class="wallet-modal-close" id="walletModalClose">CLOSE</button>
      </div>`;
    document.getElementById('walletConnectOption')?.addEventListener('click', () => {
      closeWalletModal();
      connectWallet();
    });
  }
  backdrop.classList.add('open');
  document.getElementById('walletModalClose')?.addEventListener('click', closeWalletModal);
  document.getElementById('walletDisconnectBtn')?.addEventListener('click', disconnectWallet);
  document.getElementById('rewardAssetSelect')?.addEventListener('change', (e) => {
    setRewardPreference(walletState.address, e.target.value);
    const status = document.getElementById('rewardPrefStatus');
    if (status) { status.className = 'burn-status success'; status.textContent = 'Saved (stored in this browser for now).'; }
  });
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeWalletModal(); });
}

function closeWalletModal() {
  document.getElementById('walletModalBackdrop')?.classList.remove('open');
}

/* ---------------- gated content helper ---------------- */
// Renders a locked card into `container` unless access is granted,
// in which case it calls `renderUnlocked(container)`. Use this
// anywhere a feature should require the holding threshold.
async function renderGate(container, featureName, renderUnlocked) {
  if (!container) return;
  const res = await checkAccess();
  if (res.hasAccess) {
    renderUnlocked(container);
  } else {
    const reason = res.notDeployed
      ? '$QTRM has not been deployed yet.'
      : (walletState.connected ? "This wallet doesn't hold enough $QTRM yet." : 'Connect your wallet to check eligibility.');
    container.innerHTML = `
      <div class="gate-card">
        <div class="g-lock">&#128274;</div>
        <h3>${featureName.toUpperCase()} — PREMIUM</h3>
        <p>Requires holding ${WALLET_CONFIG.requiredHoldAmount.toLocaleString()} $QTRM in a connected wallet. ${reason}</p>
        <button id="gateActionBtn-${featureName.replace(/\s+/g, '')}">
          ${walletState.connected ? 'CHECK AGAIN' : 'CONNECT WALLET'}
        </button>
      </div>`;
    const btn = container.querySelector(`#gateActionBtn-${featureName.replace(/\s+/g, '')}`);
    btn?.addEventListener('click', () => {
      if (walletState.connected) renderGate(container, featureName, renderUnlocked);
      else connectWallet();
    });
  }
}

function renderGatedContent() {
  // Hook point: called whenever wallet state changes. Pages that
  // have gated sections (see app.js) re-render them here.
  if (typeof refreshGatedSections === 'function') refreshGatedSections();
}

/* ---------------- init ---------------- */
document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('walletBtn');
  if (btn) {
    renderWalletButton();
    btn.addEventListener('click', () => openWalletModal());
  }
  tryRestoreWallet();
});
