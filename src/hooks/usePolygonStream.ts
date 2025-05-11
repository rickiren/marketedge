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

export function usePolygonStream() {
  const [data, setData] = useState<PolygonData[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const previousPrices = useRef<Map<string, number>>(new Map());
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    const connect = () => {
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error('Max reconnection attempts reached');
        return;
      }

      const pairs = COIN_PAIRS.map(symbol => `X:${symbol}USD`);
      const apiKey = 'UC7gcfqzz54FjpH_bwpgwPTTxf3tdU4q';
      const socket = new WebSocket(`wss://delayed.polygon.io/crypto`);

      socket.onopen = () => {
        console.log('Connected to Polygon.io WebSocket');
        setIsConnected(true);
        reconnectAttempts.current = 0;
        
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
            console.log('Status message:', message);
          }
        } catch (error) {
          console.error('Error processing message:', error);
        }
      };

      socket.onclose = (event) => {
        console.log('WebSocket closed:', event.code, event.reason);
        setIsConnected(false);
        reconnectAttempts.current++;
        
        // Exponential backoff for reconnection
        const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
        setTimeout(connect, delay);
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
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