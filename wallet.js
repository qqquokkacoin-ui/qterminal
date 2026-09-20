/* ============================================================
   QTERMINAL — wallet.js
   SHELL for wallet login + token-gated features. Connection
   itself is real (standard EIP-1193 / window.ethereum, works with
   MetaMask, Rabby, Coinbase Wallet browser extension, etc). The
   part that ISN'T real yet is checking how much of $QUOKKA a
   wallet has burned — that needs your actual burn mechanism
   (dedicated burn address? a burn() function on the token
   contract? a tracked ledger?) before it can be implemented, so
   it's stubbed out below with a clear TODO and a dev toggle so you
   can preview the locked/unlocked UI right now.

   TO WIRE UP REAL BURN-CHECKING LATER:
   1. Decide the mechanism (burn address vs contract burn() calls)
      once $QUOKKA's contract is finalized.
   2. Replace the body of checkAccess() below with a real read —
      either an eth_call to the token contract (balanceOf a known
      burn address filtered by sender, or a burn-tracking mapping
      if your contract has one) via a lightweight RPC call or a
      library like ethers.js/viem.
   3. REQUIRED_BURN_AMOUNT below is the number to check against —
      update it to the real number once decided.
   ============================================================ */

const WALLET_CONFIG = {
  tokenContractAddress: COIN_CONFIG.contractAddress,
  requiredBurnAmount: 10000, // placeholder — update once tokenomics are decided
  // Flip true to preview gated content as "unlocked" without a real wallet/burn.
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

/* ---------------- burn / access check (STUB) ---------------- */
async function checkAccess() {
  if (WALLET_CONFIG.DEV_FORCE_UNLOCKED) {
    return { hasAccess: true, burnedAmount: WALLET_CONFIG.requiredBurnAmount, dev: true };
  }
  if (!walletState.connected) {
    return { hasAccess: false, burnedAmount: 0 };
  }
  // TODO: replace with a real onchain read once the burn mechanism
  // is decided (see file header). Always returns "not enough burned"
  // for now so the gated UI is honestly represented.
  return { hasAccess: false, burnedAmount: 0 };
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
    backdrop.innerHTML = `
      <div class="wallet-modal">
        <h2>WALLET CONNECTED</h2>
        <div class="wm-sub">${walletState.address}</div>
        <div class="wallet-status-row"><span class="k">$QUOKKA burned</span><span class="v" id="wmBurned">checking…</span></div>
        <div class="wallet-status-row"><span class="k">Required for premium</span><span class="v">${WALLET_CONFIG.requiredBurnAmount.toLocaleString()}</span></div>
        <button class="wallet-disconnect" id="walletDisconnectBtn">DISCONNECT</button>
        <button class="wallet-modal-close" id="walletModalClose">CLOSE</button>
      </div>`;
    checkAccess().then(res => {
      const el = document.getElementById('wmBurned');
      if (el) el.textContent = res.burnedAmount.toLocaleString() + (res.hasAccess ? ' — UNLOCKED' : '');
    });
  } else {
    backdrop.innerHTML = `
      <div class="wallet-modal">
        <h2>CONNECT WALLET</h2>
        <div class="wm-sub">Connect to check $QUOKKA burn status and unlock premium features.</div>
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
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) closeWalletModal(); });
}

function closeWalletModal() {
  document.getElementById('walletModalBackdrop')?.classList.remove('open');
}

/* ---------------- gated content helper ---------------- */
// Renders a locked card into `container` unless access is granted,
// in which case it calls `renderUnlocked(container)`. Use this
// anywhere a feature should require the burn threshold.
async function renderGate(container, featureName, renderUnlocked) {
  if (!container) return;
  const res = await checkAccess();
  if (res.hasAccess) {
    renderUnlocked(container);
  } else {
    container.innerHTML = `
      <div class="gate-card">
        <div class="g-lock">&#128274;</div>
        <h3>${featureName.toUpperCase()} — PREMIUM</h3>
        <p>Requires burning ${WALLET_CONFIG.requiredBurnAmount.toLocaleString()} $QUOKKA to unlock.
           ${walletState.connected ? "This wallet hasn't burned enough yet." : 'Connect your wallet to check eligibility.'}</p>
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
