/* ============================================================
   QTERMINAL — indexes-data.js
   All 20 world indexes are now functional, each linking into
   terminal.html?idx=<ID> (NASDAQ-100 keeps the plain #TICKER form
   it always had, since it's the default market with no ?idx=).
   `tokenized` marks whether that market currently has real
   Robinhood-tokenized products (only the three US markets do, per
   the "start with US markets" decision) — flip others on as
   Robinhood actually tokenizes them.
   ============================================================ */

const WORLD_INDEXES = [
  { id: "NDX", name: "NASDAQ-100", city: "New York", country: "USA", lat: 40.7128, lon: -74.0060, functional: true, tokenized: true, route: "terminal.html#QQQ" },
  { id: "SPX", name: "S&P 500", city: "New York", country: "USA", lat: 40.7300, lon: -73.9950, functional: true, tokenized: true, route: "terminal.html?idx=SPX#SPY" },
  { id: "DJI", name: "Dow Jones", city: "New York", country: "USA", lat: 40.7060, lon: -74.0130, functional: true, tokenized: true, route: "terminal.html?idx=DJI#DIA" },
  { id: "FTSE", name: "FTSE 100", city: "London", country: "UK", lat: 51.5074, lon: -0.1278, functional: true, tokenized: false, route: "terminal.html?idx=FTSE#ISF" },
  { id: "GDAXI", name: "DAX", city: "Frankfurt", country: "Germany", lat: 50.1109, lon: 8.6821, functional: true, tokenized: false, route: "terminal.html?idx=GDAXI#EXS1" },
  { id: "FCHI", name: "CAC 40", city: "Paris", country: "France", lat: 48.8566, lon: 2.3522, functional: true, tokenized: false, route: "terminal.html?idx=FCHI#CACX" },
  { id: "STOXX50E", name: "Euro Stoxx 50", city: "Frankfurt", country: "Eurozone", lat: 50.1300, lon: 8.7100, functional: true, tokenized: false, route: "terminal.html?idx=STOXX50E#SX5E" },
  { id: "N225", name: "Nikkei 225", city: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, functional: true, tokenized: false, route: "terminal.html?idx=N225#1321.T" },
  { id: "HSI", name: "Hang Seng", city: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694, functional: true, tokenized: false, route: "terminal.html?idx=HSI#2833.HK" },
  { id: "SSEC", name: "Shanghai Composite", city: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737, functional: true, tokenized: false, route: "terminal.html?idx=SSEC#510760.SS" },
  { id: "KS11", name: "KOSPI", city: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.9780, functional: true, tokenized: false, route: "terminal.html?idx=KS11#069500.KS" },
  { id: "SENSEX", name: "SENSEX", city: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777, functional: true, tokenized: false, route: "terminal.html?idx=SENSEX#500325.BO" },
  { id: "AXJO", name: "ASX 200", city: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, functional: true, tokenized: false, route: "terminal.html?idx=AXJO#STW.AX" },
  { id: "GSPTSE", name: "TSX Composite", city: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, functional: true, tokenized: false, route: "terminal.html?idx=GSPTSE#XIC.TO" },
  { id: "BVSP", name: "Bovespa", city: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, functional: true, tokenized: false, route: "terminal.html?idx=BVSP#BOVA11.SA" },
  { id: "IBEX", name: "IBEX 35", city: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038, functional: true, tokenized: false, route: "terminal.html?idx=IBEX#IBEX35.MC" },
  { id: "FTSEMIB", name: "FTSE MIB", city: "Milan", country: "Italy", lat: 45.4642, lon: 9.1900, functional: true, tokenized: false, route: "terminal.html?idx=FTSEMIB#EWI" },
  { id: "SMI", name: "SMI", city: "Zurich", country: "Switzerland", lat: 47.3769, lon: 8.5417, functional: true, tokenized: false, route: "terminal.html?idx=SMI#CSSMI.SW" },
  { id: "STI", name: "Straits Times Index", city: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, functional: true, tokenized: false, route: "terminal.html?idx=STI#ES3.SI" },
  { id: "TWII", name: "TAIEX", city: "Taipei", country: "Taiwan", lat: 25.0330, lon: 121.5654, functional: true, tokenized: false, route: "terminal.html?idx=TWII#0050.TW" },
];
