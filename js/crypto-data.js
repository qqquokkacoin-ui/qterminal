/* ============================================================
   QTERMINAL — crypto-data.js
   ~29 major cryptocurrencies. `id` is the CoinGecko coin ID (used
   for real price/market-cap/chart data — CoinGecko's public API
   needs no key and allows direct browser calls). `category` drives
   the heatmap grouping, same pattern as stock sectors.
   ============================================================ */

const CRYPTO_UNIVERSE = [
  { id: "bitcoin", symbol: "BTC", name: "Bitcoin", category: "Layer 1" },
  { id: "ethereum", symbol: "ETH", name: "Ethereum", category: "Layer 1" },
  { id: "solana", symbol: "SOL", name: "Solana", category: "Layer 1" },
  { id: "binancecoin", symbol: "BNB", name: "BNB", category: "Exchange Token" },
  { id: "ripple", symbol: "XRP", name: "XRP", category: "Payments" },
  { id: "cardano", symbol: "ADA", name: "Cardano", category: "Layer 1" },
  { id: "dogecoin", symbol: "DOGE", name: "Dogecoin", category: "Meme" },
  { id: "avalanche-2", symbol: "AVAX", name: "Avalanche", category: "Layer 1" },
  { id: "chainlink", symbol: "LINK", name: "Chainlink", category: "Oracle" },
  { id: "polkadot", symbol: "DOT", name: "Polkadot", category: "Layer 0" },
  { id: "matic-network", symbol: "POL", name: "Polygon", category: "Layer 2" },
  { id: "litecoin", symbol: "LTC", name: "Litecoin", category: "Payments" },
  { id: "shiba-inu", symbol: "SHIB", name: "Shiba Inu", category: "Meme" },
  { id: "tron", symbol: "TRX", name: "TRON", category: "Layer 1" },
  { id: "uniswap", symbol: "UNI", name: "Uniswap", category: "DeFi" },
  { id: "cosmos", symbol: "ATOM", name: "Cosmos", category: "Layer 0" },
  { id: "stellar", symbol: "XLM", name: "Stellar", category: "Payments" },
  { id: "aptos", symbol: "APT", name: "Aptos", category: "Layer 1" },
  { id: "near", symbol: "NEAR", name: "NEAR Protocol", category: "Layer 1" },
  { id: "internet-computer", symbol: "ICP", name: "Internet Computer", category: "Layer 1" },
  { id: "aave", symbol: "AAVE", name: "Aave", category: "DeFi" },
  { id: "the-graph", symbol: "GRT", name: "The Graph", category: "Oracle" },
  { id: "render-token", symbol: "RENDER", name: "Render", category: "Infrastructure" },
  { id: "arbitrum", symbol: "ARB", name: "Arbitrum", category: "Layer 2" },
  { id: "optimism", symbol: "OP", name: "Optimism", category: "Layer 2" },
  { id: "sui", symbol: "SUI", name: "Sui", category: "Layer 1" },
  { id: "pepe", symbol: "PEPE", name: "Pepe", category: "Meme" },
  { id: "tether", symbol: "USDT", name: "Tether", category: "Stablecoin" },
  { id: "usd-coin", symbol: "USDC", name: "USD Coin", category: "Stablecoin" }
];

function getCryptoBySymbol(symbol) {
  return CRYPTO_UNIVERSE.find(c => c.symbol === symbol.toUpperCase());
}
function getCryptoCategories() {
  const seen = new Set();
  const order = [];
  for (const c of CRYPTO_UNIVERSE) {
    if (!seen.has(c.category)) { seen.add(c.category); order.push(c.category); }
  }
  return order;
}
