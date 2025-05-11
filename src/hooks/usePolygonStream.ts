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

const POLYGON_API_KEY = import.meta.env.VITE_POLYGON_API_KEY;

if (!POLYGON_API_KEY) {
  throw new Error('Polygon.io API key is missing. Please add VITE_POLYGON_API_KEY to your .env file.');
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
          apiKey: POLYGON_API_KEY
        })
      );

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (!data.results || !Array.isArray(data.results)) {
        throw new Error('Invalid API response format');
      }

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
      throw error; // Re-throw to handle in connect()
    }
  };

  useEffect(() => {
    const connect = async () => {
      try {
        // Get top 100 tickers first
        const topTickers = await fetchTopTickers();
        
        if (topTickers.length === 0) {
          throw new Error('No tickers received from API');
        }

        const socket = new WebSocket(`wss://socket.polygon.io/crypto`);

        socket.onopen = () => {
          console.log('Connected to Polygon.io WebSocket');
          setIsConnected(true);
          
          // Authenticate
          socket.send(JSON.stringify({
            action: 'auth',
            params: POLYGON_API_KEY
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
      } catch (error) {
        console.error('Failed to initialize Polygon.io connection:', error);
        setIsConnected(false);
        setTimeout(connect, 5000); // Retry after 5 seconds
      }
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