import { useState, useEffect, useRef } from 'react';
import { COIN_PAIRS } from '../utils/constants';

interface PolygonData {
  pair: string;
  price: number;
  priceChange: number;
  volume: number;
  vwap: number;
  timestamp: number;
}

const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;
const CONNECTION_TIMEOUT = 10000;

export function usePolygonStream() {
  const [data, setData] = useState<PolygonData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ws = useRef<WebSocket | null>(null);
  const previousPrices = useRef<Map<string, number>>(new Map());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const connectionTimeoutRef = useRef<number>();

  useEffect(() => {
    const connect = () => {
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        const errorMsg = 'Max reconnection attempts reached. Please check your internet connection or try again later.';
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      // Clear any existing error state when attempting to reconnect
      setError(null);

      const apiKey = import.meta.env.VITE_POLYGON_API_KEY;
      if (!apiKey) {
        const errorMsg = 'Polygon API key is not configured';
        console.error(errorMsg);
        setError(errorMsg);
        return;
      }

      try {
        const pairs = COIN_PAIRS.map(symbol => `X:${symbol}USD`);
        const socket = new WebSocket(`wss://delayed.polygon.io/crypto`);

        // Set connection timeout
        connectionTimeoutRef.current = window.setTimeout(() => {
          if (socket.readyState !== WebSocket.OPEN) {
            socket.close();
            const errorMsg = 'Connection timeout - could not connect to Polygon.io';
            console.error(errorMsg);
            setError(errorMsg);
          }
        }, CONNECTION_TIMEOUT);

        socket.onopen = () => {
          console.log('Connected to Polygon.io WebSocket');
          setIsConnected(true);
          setError(null);
          reconnectAttempts.current = 0;
          clearTimeout(connectionTimeoutRef.current);
          
          // Authenticate
          socket.send(JSON.stringify({
            action: 'auth',
            params: apiKey
          }));

          // Subscribe to crypto aggregates
          socket.send(JSON.stringify({
            action: 'subscribe',
            params: pairs.map(pair => `CA.${pair}`)
          }));
        };

        socket.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            
            if (Array.isArray(message)) {
              message.forEach(msg => {
                if (msg.ev === 'CA') { // Crypto Aggregate
                  const pair = msg.pair.replace('X:', '').replace('USD', '');
                  const previousPrice = previousPrices.current.get(pair) || msg.c;
                  const priceChange = ((msg.c - previousPrice) / previousPrice) * 100;
                  
                  previousPrices.current.set(pair, msg.c);

                  setData(prevData => {
                    const newData = prevData.filter(item => item.pair !== pair);
                    return [{
                      pair,
                      price: msg.c,
                      priceChange,
                      volume: msg.v,
                      vwap: msg.vw || msg.c,
                      timestamp: msg.e
                    }, ...newData].sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
                  });
                }
              });
            } else if (message.ev === 'status') {
              if (message.status === 'auth_failed') {
                const errorMsg = 'Authentication failed - invalid API key';
                console.error(errorMsg);
                setError(errorMsg);
                socket.close();
              } else {
                console.log('Status message:', message);
              }
            }
          } catch (error) {
            console.error('Error processing message:', error);
          }
        };

        socket.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason);
          setIsConnected(false);
          clearTimeout(connectionTimeoutRef.current);
          reconnectAttempts.current++;
          
          // Exponential backoff for reconnection
          const delay = Math.min(
            INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts.current),
            MAX_RECONNECT_DELAY
          );
          setTimeout(connect, delay);
        };

        socket.onerror = (error) => {
          const errorMsg = 'WebSocket connection error. Please check your internet connection.';
          console.error(errorMsg, error);
          setError(errorMsg);
          clearTimeout(connectionTimeoutRef.current);
        };

        ws.current = socket;
      } catch (error) {
        console.error('Error creating WebSocket connection:', error);
        setError('Failed to create WebSocket connection');
      }
    };

    connect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      clearTimeout(connectionTimeoutRef.current);
    };
  }, []);

  return { data, isConnected, error };
}