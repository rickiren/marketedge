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

// Initialize REST client with global fetch options for better error handling
const rest = restClient(POLYGON_API_KEY, undefined, {
  trace: true, // Enable request/response tracing for debugging
  timeout: 10000 // 10 second timeout
});

// Initialize WebSocket client
const cryptoWS = websocketClient(POLYGON_API_KEY).crypto();

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
        order: 'desc',
        active: true
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
    let reconnectTimeout: NodeJS.Timeout;
    let isSubscribed = true;

    const connect = async () => {
      try {
        // Get top 100 tickers first
        const topTickers = await fetchTopTickers();
        
        if (!isSubscribed) return; // Check if component is still mounted

        if (topTickers.length === 0) {
          throw new Error('No tickers received from API');
        }

        // Set up WebSocket handlers
        cryptoWS.onmessage = (message) => {
          if (!isSubscribed) return;
          try {
            const [msg] = JSON.parse(message.data);
            
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
          } catch (error) {
            console.error('Error processing WebSocket message:', error);
          }
        };

        cryptoWS.onopen = () => {
          if (!isSubscribed) return;
          console.log('Connected to Polygon.io WebSocket');
          setIsConnected(true);
          
          // Subscribe to minute aggregates for top tickers
          const subscriptions = topTickers.map(ticker => `XA.${ticker}`);
          cryptoWS.subscribe(subscriptions);
          console.log('Subscribed to:', subscriptions);
        };

        cryptoWS.onclose = () => {
          if (!isSubscribed) return;
          console.log('Disconnected from Polygon.io WebSocket');
          setIsConnected(false);
          
          // Clear any existing reconnection timeout
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          
          // Attempt to reconnect after 5 seconds
          reconnectTimeout = setTimeout(connect, 5000);
        };

        cryptoWS.onerror = (error) => {
          if (!isSubscribed) return;
          console.error('WebSocket error:', error);
          cryptoWS.close();
        };

      } catch (error) {
        if (!isSubscribed) return;
        console.error('Failed to initialize Polygon.io connection:', error);
        setIsConnected(false);
        
        // Clear any existing reconnection timeout
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        // Attempt to reconnect after 5 seconds
        reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    connect();

    // Cleanup function
    return () => {
      isSubscribed = false;
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
      cryptoWS.close();
    };
  }, []);

  return { data, isConnected };
}