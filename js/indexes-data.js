/* ============================================================
   QTERMINAL — indexes-data.js
   Top 20 world indexes, with their host city's real coordinates,
   for the market-selector globe. Only NASDAQ-100 (QQQ) is wired
   to an actual page right now — the rest are placeholders so the
   globe/button grid is fully populated ahead of building out each
   market, per your instructions. Flip `functional: true` once a
   market's page is built, and `tokenized: true` once Robinhood
   actually tokenizes that market's flagship product, then set
   `route` accordingly.
   ============================================================ */

const WORLD_INDEXES = [
  { id: "NDX", name: "NASDAQ-100", city: "New York", country: "USA", lat: 40.7128, lon: -74.0060, functional: true, tokenized: true, route: "terminal.html#QQQ" },
  { id: "SPX", name: "S&P 500", city: "New York", country: "USA", lat: 40.7300, lon: -73.9950, functional: false, tokenized: false },
  { id: "DJI", name: "Dow Jones", city: "New York", country: "USA", lat: 40.7060, lon: -74.0130, functional: false, tokenized: false },
  { id: "FTSE", name: "FTSE 100", city: "London", country: "UK", lat: 51.5074, lon: -0.1278, functional: false, tokenized: false },
  { id: "GDAXI", name: "DAX", city: "Frankfurt", country: "Germany", lat: 50.1109, lon: 8.6821, functional: false, tokenized: false },
  { id: "FCHI", name: "CAC 40", city: "Paris", country: "France", lat: 48.8566, lon: 2.3522, functional: false, tokenized: false },
  { id: "STOXX50E", name: "Euro Stoxx 50", city: "Frankfurt", country: "Eurozone", lat: 50.1300, lon: 8.7100, functional: false, tokenized: false },
  { id: "N225", name: "Nikkei 225", city: "Tokyo", country: "Japan", lat: 35.6762, lon: 139.6503, functional: false, tokenized: false },
  { id: "HSI", name: "Hang Seng", city: "Hong Kong", country: "China", lat: 22.3193, lon: 114.1694, functional: false, tokenized: false },
  { id: "SSEC", name: "Shanghai Composite", city: "Shanghai", country: "China", lat: 31.2304, lon: 121.4737, functional: false, tokenized: false },
  { id: "KS11", name: "KOSPI", city: "Seoul", country: "South Korea", lat: 37.5665, lon: 126.9780, functional: false, tokenized: false },
  { id: "SENSEX", name: "SENSEX", city: "Mumbai", country: "India", lat: 19.0760, lon: 72.8777, functional: false, tokenized: false },
  { id: "AXJO", name: "ASX 200", city: "Sydney", country: "Australia", lat: -33.8688, lon: 151.2093, functional: false, tokenized: false },
  { id: "GSPTSE", name: "TSX Composite", city: "Toronto", country: "Canada", lat: 43.6532, lon: -79.3832, functional: false, tokenized: false },
  { id: "BVSP", name: "Bovespa", city: "São Paulo", country: "Brazil", lat: -23.5505, lon: -46.6333, functional: false, tokenized: false },
  { id: "IBEX", name: "IBEX 35", city: "Madrid", country: "Spain", lat: 40.4168, lon: -3.7038, functional: false, tokenized: false },
  { id: "FTSEMIB", name: "FTSE MIB", city: "Milan", country: "Italy", lat: 45.4642, lon: 9.1900, functional: false, tokenized: false },
  { id: "SMI", name: "SMI", city: "Zurich", country: "Switzerland", lat: 47.3769, lon: 8.5417, functional: false, tokenized: false },
  { id: "STI", name: "Straits Times Index", city: "Singapore", country: "Singapore", lat: 1.3521, lon: 103.8198, functional: false, tokenized: false },
  { id: "TWII", name: "TAIEX", city: "Taipei", country: "Taiwan", lat: 25.0330, lon: 121.5654, functional: false, tokenized: false }
];
