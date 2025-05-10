export interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  high_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
  previousPrice?: number;
  market_cap: number;
  price_change_5m?: number;
  volume_ratio?: number;
  last_update?: Date;
  day_high?: number;
  is_new_high?: boolean;
  initial_price?: number;
  relative_volume?: number;
  spike_factor?: number;
}

export interface CryptoCompareResponse {
  Response: string;
  Message: string;
  RAW: {
    [key: string]: {
      USD: {
        PRICE: number;
        HIGH24HOUR: number;
        CHANGEPCT24HOUR: number;
        VOLUME24HOUR: number;
        MKTCAP: number;
        IMAGEURL: string;
      };
    };
  };
}

export interface ApiResponse {
  isLoading: boolean;
  error: string | null;
  data: CoinData[];
}

export interface MomentumAlert {
  symbol: string;
  price_change_5m: number;
  volume_ratio: number;
  timestamp: Date;
}

export interface HistoricalDataPoint {
  time: number;
  close: number;
  high: number;
  low: number;
  open: number;
  volumefrom: number;
  volumeto: number;
}