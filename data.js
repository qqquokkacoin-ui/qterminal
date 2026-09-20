/* ============================================================
   QTERMINAL — data.js
   Static constituent list for the tracked universe.

   NOTE ON ACCURACY:
   - The NASDAQ-100 changes composition periodically (annual
     reconstitution + occasional swaps). This list is a reasonable
     snapshot but should be checked against the official Nasdaq-100
     factsheet before this goes live.
   - `tokenized` flags whether Robinhood's Stock Tokens product
     currently offers a token for that name. Robinhood's catalog is
     large (2000+ tickers as of early 2026) so most names here are
     flagged true — but this is a manually-set placeholder, not a
     live lookup. Update `tokenized` per-ticker as you confirm
     against Robinhood's own listing page.
   - `marketCapB` is an approximate market cap in $ billions, used
     only to size heatmap tiles in "by market cap" mode. Rough
     order-of-magnitude, not a live figure.
   ============================================================ */

const INDEX_TICKER = {
  ticker: "QQQ",
  name: "Invesco QQQ Trust",
  sector: "Index",
  tokenized: true,
  marketCapB: 340
};

const CONSTITUENTS = [
  // ---- Technology ----
  { ticker: "AAPL", name: "Apple Inc.", sector: "Technology", tokenized: true, marketCapB: 3400 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Technology", tokenized: true, marketCapB: 3200 },
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Technology", tokenized: true, marketCapB: 3600 },
  { ticker: "AVGO", name: "Broadcom Inc.", sector: "Technology", tokenized: true, marketCapB: 1400 },
  { ticker: "AMD", name: "Advanced Micro Devices", sector: "Technology", tokenized: true, marketCapB: 260 },
  { ticker: "ADBE", name: "Adobe Inc.", sector: "Technology", tokenized: true, marketCapB: 220 },
  { ticker: "CSCO", name: "Cisco Systems", sector: "Technology", tokenized: true, marketCapB: 240 },
  { ticker: "CRM", name: "Salesforce Inc.", sector: "Technology", tokenized: true, marketCapB: 260 },
  { ticker: "INTC", name: "Intel Corp.", sector: "Technology", tokenized: true, marketCapB: 110 },
  { ticker: "QCOM", name: "Qualcomm Inc.", sector: "Technology", tokenized: true, marketCapB: 190 },
  { ticker: "TXN", name: "Texas Instruments", sector: "Technology", tokenized: true, marketCapB: 170 },
  { ticker: "AMAT", name: "Applied Materials", sector: "Technology", tokenized: true, marketCapB: 150 },
  { ticker: "MU", name: "Micron Technology", sector: "Technology", tokenized: true, marketCapB: 130 },
  { ticker: "LRCX", name: "Lam Research", sector: "Technology", tokenized: true, marketCapB: 120 },
  { ticker: "KLAC", name: "KLA Corp.", sector: "Technology", tokenized: true, marketCapB: 110 },
  { ticker: "ADI", name: "Analog Devices", sector: "Technology", tokenized: true, marketCapB: 100 },
  { ticker: "NXPI", name: "NXP Semiconductors", sector: "Technology", tokenized: false, marketCapB: 55 },
  { ticker: "MRVL", name: "Marvell Technology", sector: "Technology", tokenized: true, marketCapB: 70 },
  { ticker: "GFS", name: "GlobalFoundries", sector: "Technology", tokenized: false, marketCapB: 25 },
  { ticker: "ARM", name: "Arm Holdings", sector: "Technology", tokenized: true, marketCapB: 140 },
  { ticker: "INTU", name: "Intuit Inc.", sector: "Technology", tokenized: true, marketCapB: 180 },
  { ticker: "NOW", name: "ServiceNow Inc.", sector: "Technology", tokenized: true, marketCapB: 190 },
  { ticker: "PANW", name: "Palo Alto Networks", sector: "Technology", tokenized: true, marketCapB: 120 },
  { ticker: "CRWD", name: "CrowdStrike Holdings", sector: "Technology", tokenized: true, marketCapB: 90 },
  { ticker: "FTNT", name: "Fortinet Inc.", sector: "Technology", tokenized: false, marketCapB: 70 },
  { ticker: "SNPS", name: "Synopsys Inc.", sector: "Technology", tokenized: false, marketCapB: 85 },
  { ticker: "CDNS", name: "Cadence Design Systems", sector: "Technology", tokenized: false, marketCapB: 90 },
  { ticker: "WDAY", name: "Workday Inc.", sector: "Technology", tokenized: true, marketCapB: 60 },
  { ticker: "DDOG", name: "Datadog Inc.", sector: "Technology", tokenized: true, marketCapB: 45 },
  { ticker: "TEAM", name: "Atlassian Corp.", sector: "Technology", tokenized: false, marketCapB: 50 },
  { ticker: "ZS", name: "Zscaler Inc.", sector: "Technology", tokenized: false, marketCapB: 30 },
  { ticker: "PLTR", name: "Palantir Technologies", sector: "Technology", tokenized: true, marketCapB: 180 },
  { ticker: "APP", name: "AppLovin Corp.", sector: "Technology", tokenized: true, marketCapB: 110 },
  { ticker: "ASML", name: "ASML Holding", sector: "Technology", tokenized: true, marketCapB: 320 },
  { ticker: "CDW", name: "CDW Corp.", sector: "Technology", tokenized: false, marketCapB: 20 },
  { ticker: "ANSS", name: "Ansys Inc.", sector: "Technology", tokenized: false, marketCapB: 30 },

  // ---- Communication Services ----
  { ticker: "GOOGL", name: "Alphabet Inc. Class A", sector: "Communication", tokenized: true, marketCapB: 2200 },
  { ticker: "GOOG", name: "Alphabet Inc. Class C", sector: "Communication", tokenized: true, marketCapB: 2200 },
  { ticker: "META", name: "Meta Platforms Inc.", sector: "Communication", tokenized: true, marketCapB: 1500 },
  { ticker: "NFLX", name: "Netflix Inc.", sector: "Communication", tokenized: true, marketCapB: 380 },
  { ticker: "CMCSA", name: "Comcast Corp.", sector: "Communication", tokenized: false, marketCapB: 130 },
  { ticker: "TMUS", name: "T-Mobile US Inc.", sector: "Communication", tokenized: true, marketCapB: 260 },
  { ticker: "CHTR", name: "Charter Communications", sector: "Communication", tokenized: false, marketCapB: 45 },
  { ticker: "EA", name: "Electronic Arts", sector: "Communication", tokenized: true, marketCapB: 45 },
  { ticker: "WBD", name: "Warner Bros. Discovery", sector: "Communication", tokenized: false, marketCapB: 30 },
  { ticker: "TTD", name: "The Trade Desk", sector: "Communication", tokenized: true, marketCapB: 35 },

  // ---- Consumer Discretionary ----
  { ticker: "AMZN", name: "Amazon.com Inc.", sector: "Consumer Disc.", tokenized: true, marketCapB: 2000 },
  { ticker: "TSLA", name: "Tesla Inc.", sector: "Consumer Disc.", tokenized: true, marketCapB: 1100 },
  { ticker: "BKNG", name: "Booking Holdings", sector: "Consumer Disc.", tokenized: false, marketCapB: 150 },
  { ticker: "SBUX", name: "Starbucks Corp.", sector: "Consumer Disc.", tokenized: true, marketCapB: 100 },
  { ticker: "MAR", name: "Marriott International", sector: "Consumer Disc.", tokenized: false, marketCapB: 75 },
  { ticker: "ORLY", name: "O'Reilly Automotive", sector: "Consumer Disc.", tokenized: false, marketCapB: 75 },
  { ticker: "ROST", name: "Ross Stores", sector: "Consumer Disc.", tokenized: false, marketCapB: 45 },
  { ticker: "LULU", name: "Lululemon Athletica", sector: "Consumer Disc.", tokenized: true, marketCapB: 30 },
  { ticker: "ABNB", name: "Airbnb Inc.", sector: "Consumer Disc.", tokenized: true, marketCapB: 85 },
  { ticker: "DASH", name: "DoorDash Inc.", sector: "Consumer Disc.", tokenized: true, marketCapB: 70 },
  { ticker: "MELI", name: "MercadoLibre Inc.", sector: "Consumer Disc.", tokenized: true, marketCapB: 100 },
  { ticker: "CPRT", name: "Copart Inc.", sector: "Consumer Disc.", tokenized: false, marketCapB: 55 },

  // ---- Consumer Staples ----
  { ticker: "COST", name: "Costco Wholesale", sector: "Consumer Staples", tokenized: true, marketCapB: 420 },
  { ticker: "PEP", name: "PepsiCo Inc.", sector: "Consumer Staples", tokenized: true, marketCapB: 210 },
  { ticker: "MDLZ", name: "Mondelez International", sector: "Consumer Staples", tokenized: false, marketCapB: 90 },
  { ticker: "KDP", name: "Keurig Dr Pepper", sector: "Consumer Staples", tokenized: false, marketCapB: 45 },
  { ticker: "MNST", name: "Monster Beverage", sector: "Consumer Staples", tokenized: false, marketCapB: 55 },
  { ticker: "KHC", name: "Kraft Heinz Co.", sector: "Consumer Staples", tokenized: false, marketCapB: 35 },

  // ---- Health Care ----
  { ticker: "AMGN", name: "Amgen Inc.", sector: "Health Care", tokenized: true, marketCapB: 160 },
  { ticker: "GILD", name: "Gilead Sciences", sector: "Health Care", tokenized: true, marketCapB: 120 },
  { ticker: "VRTX", name: "Vertex Pharmaceuticals", sector: "Health Care", tokenized: false, marketCapB: 120 },
  { ticker: "REGN", name: "Regeneron Pharmaceuticals", sector: "Health Care", tokenized: false, marketCapB: 80 },
  { ticker: "ISRG", name: "Intuitive Surgical", sector: "Health Care", tokenized: true, marketCapB: 190 },
  { ticker: "IDXX", name: "IDEXX Laboratories", sector: "Health Care", tokenized: false, marketCapB: 35 },
  { ticker: "DXCM", name: "Dexcom Inc.", sector: "Health Care", tokenized: false, marketCapB: 30 },
  { ticker: "GEHC", name: "GE HealthCare", sector: "Health Care", tokenized: false, marketCapB: 35 },

  // ---- Industrials ----
  { ticker: "HON", name: "Honeywell International", sector: "Industrials", tokenized: true, marketCapB: 140 },
  { ticker: "CSX", name: "CSX Corp.", sector: "Industrials", tokenized: false, marketCapB: 60 },
  { ticker: "PCAR", name: "Paccar Inc.", sector: "Industrials", tokenized: false, marketCapB: 55 },
  { ticker: "ODFL", name: "Old Dominion Freight Line", sector: "Industrials", tokenized: false, marketCapB: 40 },
  { ticker: "FAST", name: "Fastenal Co.", sector: "Industrials", tokenized: false, marketCapB: 45 },
  { ticker: "CTAS", name: "Cintas Corp.", sector: "Industrials", tokenized: false, marketCapB: 80 },
  { ticker: "VRSK", name: "Verisk Analytics", sector: "Industrials", tokenized: false, marketCapB: 40 },
  { ticker: "PAYX", name: "Paychex Inc.", sector: "Industrials", tokenized: false, marketCapB: 45 },
  { ticker: "ADP", name: "Automatic Data Processing", sector: "Industrials", tokenized: true, marketCapB: 120 },
  { ticker: "CSGP", name: "CoStar Group", sector: "Industrials", tokenized: false, marketCapB: 30 },

  // ---- Financials / Fintech ----
  { ticker: "PYPL", name: "PayPal Holdings", sector: "Financials", tokenized: true, marketCapB: 75 },
  { ticker: "FI", name: "Fiserv Inc.", sector: "Financials", tokenized: false, marketCapB: 90 },
  { ticker: "COIN", name: "Coinbase Global", sector: "Financials", tokenized: true, marketCapB: 65 },
  { ticker: "FICO", name: "Fair Isaac Corp.", sector: "Financials", tokenized: false, marketCapB: 45 },

  // ---- Utilities ----
  { ticker: "AEP", name: "American Electric Power", sector: "Utilities", tokenized: false, marketCapB: 55 },
  { ticker: "EXC", name: "Exelon Corp.", sector: "Utilities", tokenized: false, marketCapB: 45 },
  { ticker: "XEL", name: "Xcel Energy", sector: "Utilities", tokenized: false, marketCapB: 40 },
  { ticker: "CEG", name: "Constellation Energy", sector: "Utilities", tokenized: true, marketCapB: 95 },

  // ---- Materials / Energy ----
  { ticker: "LIN", name: "Linde plc", sector: "Materials", tokenized: true, marketCapB: 220 },
  { ticker: "FANG", name: "Diamondback Energy", sector: "Energy", tokenized: false, marketCapB: 40 },

  // ---- Other ----
  { ticker: "CCEP", name: "Coca-Cola Europacific Partners", sector: "Consumer Staples", tokenized: false, marketCapB: 30 },
  { ticker: "SIRI", name: "Sirius XM Holdings", sector: "Communication", tokenized: false, marketCapB: 8 },
];

// Full universe, QQQ first.
const UNIVERSE = [INDEX_TICKER, ...CONSTITUENTS];

function getTickerData(ticker) {
  return UNIVERSE.find(t => t.ticker === ticker.toUpperCase());
}

function getSectors() {
  const seen = new Set();
  const order = [];
  for (const t of CONSTITUENTS) {
    if (!seen.has(t.sector)) { seen.add(t.sector); order.push(t.sector); }
  }
  return order;
}
