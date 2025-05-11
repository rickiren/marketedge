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

  useEffect(() => {
    const connect = () => {
      const pairs = COIN_PAIRS.map(symbol => `X:${symbol}USD`);
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

        // Subscribe to minute aggregates for all pairs
        socket.send(JSON.stringify({
          action: 'subscribe',
          params: pairs.map(pair => `XA.${pair}`)
        }));
      };

      socket.onmessage = (event) => {
        const message = JSON.parse(event.data);
        
        if (Array.isArray(message)) {
          message.forEach(msg => {
            if (msg.ev === 'XA') { // Aggregate event
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
                  vwap: msg.vw,
                  timestamp: msg.e
                }, ...newData].sort((a, b) => Math.abs(b.priceChange) - Math.abs(a.priceChange));
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