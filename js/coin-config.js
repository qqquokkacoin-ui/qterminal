/* ============================================================
   QTERMINAL — coin-config.js
   Everything the landing page's coin section (and the wallet
   holding-check in wallet.js) reads from here.

   STATUS: QTRM hasn't been deployed yet. contractAddress is
   deliberately blank — everything downstream (the landing page's
   contract box, the wallet's holding check) already renders a
   safe "not set yet" state rather than a broken one. Fill in
   contractAddress, chain, and the social links once QTRM exists.

   NOTE ON CHAIN: Robinhood's Stock Tokens currently settle on
   Arbitrum One, with Robinhood Chain (Robinhood's own Arbitrum-
   stack L2, mainnet since July 2026) taking over — but which one
   is authoritative can still shift, so confirm the current
   settlement venue before deploying QTRM there. Whichever it is,
   deploying on the same chain as the Stock Tokens is what makes
   the reward mechanism (see wallet.js) practical: swapping treasury
   funds into a holder's chosen Stock Token via an on-chain AMM
   (Uniswap is integrated on Robinhood Chain from day one) only
   works cleanly if QTRM and the Stock Tokens share a chain.

   Binance/Coinbase links stay blank until QTRM is actually listed
   there — a brand-new token showing fake CEX links is a classic
   scam pattern, so "soon: true" renders a plain "SOON" tag instead
   of a dead or misleading link.
   ============================================================ */

const COIN_CONFIG = {
  ticker: "$QTRM",
  tagline: "The coin behind Qterminal. Hold it to unlock premium features and earn rewards paid in the tokenized stock of your choice.",
  chain: "", // e.g. "Robinhood Chain", "Arbitrum One" — confirm current settlement venue before setting
  contractAddress: "", // not deployed yet
  logo: "images/qtrm-logo.png",
  explorerTxUrl: "", // e.g. "https://explorer.<chain>.io/tx/" — for wallet.js's transaction links once live

  links: {
    x: "",
    telegram: "",
    dexscreener: "",
    binance: "",
    coinbase: ""
  },
  soon: {
    binance: true,
    coinbase: true
  }
};
