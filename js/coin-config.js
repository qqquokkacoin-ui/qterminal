/* ============================================================
   QTERMINAL — coin-config.js
   Everything the landing page's coin section shows comes from
   here. Fill in the real values and the page updates itself —
   no other file needs touching.

   Any link left as an empty string "" renders as a greyed-out,
   unclickable row instead of a dead/wrong link — so it's safe to
   leave things blank until you've actually got them confirmed.

   NOTE: Binance and Coinbase links are included because you asked
   for them, but as of this file being written they're empty — a
   brand-new token isn't listed on centralized exchanges like that
   without going through their listing process. Only fill these in
   once the coin is actually listed there; otherwise leave blank
   rather than link somewhere it doesn't exist, which reads as a
   scam pattern (fake CEX listing claims are one of the most common
   things used to bait people into buying).
   ============================================================ */

const COIN_CONFIG = {
  ticker: "$QUOKKA",
  tagline: "QuokkaOnHood — the community coin powering Qterminal. Follow along on X for updates.",
  chain: "", // e.g. "Solana", "Base", "Ethereum"
  contractAddress: "", // paste the real CA here — shown as-is, never shortened/altered

  links: {
    x: "https://x.com/QuokkaOnHood",
    telegram: "",       // e.g. "https://t.me/yourgroup"
    dexscreener: "",    // e.g. "https://dexscreener.com/solana/xxxxx"
    binance: "",        // leave blank unless actually listed
    coinbase: ""        // leave blank unless actually listed
  }
};
