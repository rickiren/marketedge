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

// Enhanced API key validation
if (!POLYGON_API_KEY || POLYGON_API_KEY.trim() === '') {
  throw new Error('Invalid or missing Polygon.io API key. Please add a valid VITE_POLYGON_API_KEY to your .env file.');
}

// Initialize REST client with improved error handling options
const rest = restClient(POLYGON_API_KEY, undefined, {
  trace: true,
  timeout: 15000, // Increased timeout for better reliability
  headers: {
    'User-Agent': 'CryptoScanner/1.0' // Add user agent for better request tracking
  }
});

// Initialize WebSocket client
const cryptoWS = websocketClient(POLYGON_API_KEY).crypto();

export function usePolygonStream() {
  const [data, setData] = useState<PolygonData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const previousPrices = useRef<Map<string, number>>(new Map());
  const marketCaps = useRef<Map<string, number>>(new Map());

  // Enhanced error handling for top tickers fetch
  const fetchTopTickers = async (): Promise<string[]> => {
    try {
      const response = await rest.reference.tickers({
        market: 'crypto',
        limit: 100,
        sort: 'market_cap',
        order: 'desc',
        active: true
      });

      // Enhanced response validation
      if (!response) {
        throw new Error('No response received from Polygon API');
      }

      if (!response.results) {
        throw new Error('Invalid API response: missing results array');
      }

      if (!Array.isArray(response.results)) {
        throw new Error('Invalid API response: results is not an array');
      }

      if (response.results.length === 0) {
        console.warn('Warning: No tickers returned from API');
        return []; // Return empty array instead of throwing
      }

      const tickers: Ticker[] = response.results
        .filter(result => result && typeof result === 'object')
        .map((result: any) => ({
          ticker: result.ticker || '',
          marketCap: typeof result.market_cap === 'number' ? result.market_cap : 0
        }))
        .filter(ticker => ticker.ticker !== ''); // Filter out any invalid tickers

      // Store market caps for later use
      tickers.forEach(({ ticker, marketCap }) => {
        marketCaps.current.set(ticker, marketCap);
      });

      return tickers.map(t => t.ticker);
    } catch (error: any) {
      // Enhanced error logging
      console.error('Error fetching top tickers:', {
        message: error.message,
        status: error.status,
        requestId: error.request_id,
        response: error.response
      });

      // Rethrow with more context
      throw new Error(`Failed to fetch top tickers: ${error.message}`);
    }
  };

  useEffect(() => {
    let reconnectTimeout: NodeJS.Timeout;
    let isSubscribed = true;
    let reconnectAttempts = 0;
    const MAX_RECONNECT_ATTEMPTS = 5;
    const INITIAL_RECONNECT_DELAY = 5000;

    const connect = async () => {
      try {
        // Reset connection state
        setIsConnected(false);
        
        // Get top 100 tickers first
        const topTickers = await fetchTopTickers();
        
        if (!isSubscribed) return;

        if (topTickers.length === 0) {
          console.warn('No tickers available, waiting before retry...');
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts));
            return;
          }
          throw new Error('Failed to get tickers after maximum retry attempts');
        }

        // Reset reconnect attempts on successful connection
        reconnectAttempts = 0;

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
          
          if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
          }
          
          if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeout = setTimeout(() => {
              reconnectAttempts++;
              connect();
            }, INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts));
          } else {
            console.error('Maximum reconnection attempts reached');
          }
        };

        cryptoWS.onerror = (error) => {
          if (!isSubscribed) return;
          console.error('WebSocket error:', error);
          cryptoWS.close();
        };

      } catch (error: any) {
        if (!isSubscribed) return;
        console.error('Failed to initialize Polygon.io connection:', {
          message: error.message,
          status: error.status,
          requestId: error.request_id
        });
        
        setIsConnected(false);
        
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
        
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          reconnectTimeout = setTimeout(() => {
            reconnectAttempts++;
            connect();
          }, INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts));
        } else {
          console.error('Maximum reconnection attempts reached');
        }
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