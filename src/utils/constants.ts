// List of coin pairs to fetch
export const COIN_PAIRS = [
  "BTC", "ETH", "XRP", "EOS", "MATIC", "BNB", "LINK", "DYDX", "AXS", "GALA", 
  "SAND", "UNI", "QNT", "INJ", "AAVE", "MANA", "IMX", "FTT", "SUSHI", "CAKE", 
  "C98", "ARB", "OP", "WLD", "PEPE", "BLUR", "MAGIC", "MASK", "PLANET", "CTC", 
  "SFUND", "5IRE", "TRX", "LDO", "BEAM", "HFT", "FON", "GMX", "HOOK", "AXL", 
  "CRV", "ROOT", "WOO", "CGPT", "MEME", "GMT", "MNT", "SVL", "SOL", "DOGE", 
  "ARKM", "SHIB", "ONDO", "FLT", "CHZ", "ATH", "IO", "BRETT", "WIF", "ENA", 
  "FLOKI", "PEOPLE", "ZRO", "JUP", "BONK", "ENS", "ETHFI", "RENDER", "MEW", "NAKA", 
  "JASMY", "ZIG", "BOME", "STETH", "AVAX", "JTO", "AGLA", "FET", "DBR", 
  "SONIC", "NC", "USDC", "TRUMP", "WLF",
  // New coins
  "LOOKS", "BMT", "BABY", "PHB", "SEND", "PERP", "VRA", "ACE", "SONIC", "VINE",
  "CHESS", "PARTI", "SERAPH", "SYS", "ALEO", "MUBARAK", "DOGS", "SOLV", "1000FLOKI",
  "DUCK", "WOO", "COTI", "ETHW", "ALPHA", "CARV", "MAV", "NFP", "GMT", "BSW",
  "VOXEL", "FLM", "DRIFT", "CAT", "FOXY", "NKN", "CTK", "HIFI", "AKT",
  // Additional new coins
  "BAL", "AIXBT", "PRIME", "VIRTUAL", "VRA", "BEAM", "AVAAI", "CHILLGUY",
  "ALPHA", "WAL", "GRIFFAIN", "CGPT", "ZBCN", "S", "PRCL", "MORPHO",
  "10000WEN", "ARC", "SWARMS", "KMNO", "AVL", "AGLD", "PIPPIN", "AI16Z",
  "VVV", "COOKIE", "MYRIA"
];

// Mapping of CoinGecko ids to symbols for some coins that might have different ids
export const SYMBOL_TO_ID_MAP: Record<string, string> = {
  // Add mappings as needed if CoinGecko uses different IDs
  "BTC": "bitcoin",
  "ETH": "ethereum",
  "USDT": "tether",
  "XRP": "ripple",
  "BNB": "binancecoin",
  "SOL": "solana",
  "DOGE": "dogecoin",
  "SHIB": "shiba-inu",
  "AVAX": "avalanche-2",
  "MATIC": "matic-network",
  "LINK": "chainlink",
  "UNI": "uniswap",
};

// Number of milliseconds between data refreshes
export const REFRESH_INTERVAL = 5000;

// Maximum number of coins to display in the table
export const MAX_COINS = 100;