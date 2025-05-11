import { useState, useEffect, useRef } from 'react';

interface PolygonData {
  pair: string;
  price: number;
  priceChange: number;
  volume: number;
  vwap: number;
  timestamp: number;
  marketCap?: number;
}

interface Ticker {
  ticker: string;
  marketCap: number;
}

export function usePolygonStream() {
  const [data, setData] = useState<PolygonData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const previousPrices = useRef<Map<string, number>>(new Map());
  const marketCaps = useRef<Map<string, number>>(new Map());

  // Fetch top 100 tickers by market cap
  const fetchTopTickers = async (): Promise<string[]> => {
    try {
      const response = await fetch(
        'https://api.polygon.io/v3/snapshot/locale/global/markets/crypto/tickers?' +
        new URLSearchParams({
          limit: '100',
          sort: 'market_cap',
          order: 'desc',
          apiKey: 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q'
        })
      );

      if (!response.ok) {
        throw new Error('Failed to fetch tickers');
      }

      const data = await response.json();
      const tickers: Ticker[] = data.results.map((result: any) => ({
        ticker: result.ticker,
        marketCap: result.market_cap
      }));

      // Store market caps for later use
      tickers.forEach(({ ticker, marketCap }) => {
        marketCaps.current.set(ticker, marketCap);
      });

      return tickers.map(t => t.ticker);
    } catch (error) {
      console.error('Error fetching top tickers:', error);
      return [];
    }
  };

  useEffect(() => {
    const connect = async () => {
      // Get top 100 tickers first
      const topTickers = await fetchTopTickers();
      if (topTickers.length === 0) return;

      const apiKey = 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q';
      const socket = new WebSocket(`wss://socket.polygon.io/crypto`);

      socket.onopen = () => {
        console.log('Connected to Polygon.io WebSocket');
        setIsConnected(true);
        
        // Authenticate
        socket.send(JSON.stringify({
          action: 'auth',
          params: apiKey
        }));

        // Subscribe to minute aggregates for top tickers
        socket.send(JSON.stringify({
          action: 'subscribe',
          params: topTickers.map(ticker => `XA.${ticker}`)
        }));
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (Array.isArray(message)) {
          message.forEach(msg => {
            if (msg.ev === 'XA') { // Aggregate event
              const pair = msg.pair;
              const previousPrice = previousPrices.current.get(pair) || msg.c;
              const priceChange = ((msg.c - previousPrice) / previousPrice) * 100;
              const marketCap = marketCaps.current.get(pair);
              
              previousPrices.current.set(pair, msg.c);

              setData(prevData => {
                const newData = prevData.filter(item => item.pair !== pair);
                return [{
                  pair,
                  price: msg.c,
                  priceChange,
                  volume: msg.v,
                  vwap: msg.vw,
                  timestamp: msg.e,
                  marketCap
                }, ...newData].sort((a, b) => (b.marketCap || 0) - (a.marketCap || 0));
              });
            }
          });
        }
      };

      socket.onclose = () => {
        console.log('Disconnected from Polygon.io WebSocket');
        setIsConnected(false);
        setTimeout(connect, 5000); // Reconnect after 5 seconds
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
        socket.close();
      };

      ws.current = socket;
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  return { data, isConnected };
}