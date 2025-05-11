import { useState, useEffect, useRef } from 'react';
import { restClient, websocketClient } from '@polygon.io/client-js';

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

const rest = restClient(POLYGON_API_KEY);
const ws = websocketClient(POLYGON_API_KEY);

export function usePolygonStream() {
  const [data, setData] = useState<PolygonData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const previousPrices = useRef<Map<string, number>>(new Map());
  const marketCaps = useRef<Map<string, number>>(new Map());

  // Fetch top 100 tickers by market cap
  const fetchTopTickers = async (): Promise<string[]> => {
    try {
      const response = await rest.reference.tickers({
        market: 'crypto',
        limit: 100,
        sort: 'market_cap',
        order: 'desc'
      });

      if (!response.results || !Array.isArray(response.results)) {
        throw new Error('Invalid API response format');
      }

      const tickers: Ticker[] = response.results.map((result: any) => ({
        ticker: result.ticker,
        marketCap: result.market_cap || 0
      }));

      // Store market caps for later use
      tickers.forEach(({ ticker, marketCap }) => {
        marketCaps.current.set(ticker, marketCap);
      });

      return tickers.map(t => t.ticker);
    } catch (error) {
      console.error('Error fetching top tickers:', error);
      throw error;
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

        // Set up WebSocket connection
        ws.onmessage(message => {
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
        });

        ws.onopen(() => {
          console.log('Connected to Polygon.io WebSocket');
          setIsConnected(true);
          
          // Subscribe to minute aggregates for top tickers
          ws.subscribe(`XA.${topTickers.join(',XA.')}`);
        });

        ws.onclose(() => {
          console.log('Disconnected from Polygon.io WebSocket');
          setIsConnected(false);
          setTimeout(connect, 5000); // Reconnect after 5 seconds
        });

        ws.onerror((error) => {
          console.error('WebSocket error:', error);
          ws.close();
        });

      } catch (error) {
        console.error('Failed to initialize Polygon.io connection:', error);
        setIsConnected(false);
        setTimeout(connect, 5000); // Retry after 5 seconds
      }
    };

    connect();

    return () => {
      ws.close();
    };
  }, []);

  return { data, isConnected };
}