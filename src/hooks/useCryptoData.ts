import { useState, useEffect, useRef } from 'react';
import { CoinData, ApiResponse } from '../types';
import { fetchCoinData } from '../services/api';
import { REFRESH_INTERVAL } from '../utils/constants';
import { supabase } from '../lib/supabase';

interface DayHighData {
  high_of_day: number;
  timestamp: number;
  initialPrice: number;
}

export const useCryptoData = (): ApiResponse => {
  const [state, setState] = useState<ApiResponse>({
    isLoading: true,
    error: null,
    data: []
  });
  
  const previousDataRef = useRef<CoinData[]>([]);
  const dayHighsRef = useRef<Map<string, DayHighData>>(new Map());
  const lastAlertRef = useRef<Map<string, number>>(new Map());
  const fetchTimeoutRef = useRef<NodeJS.Timeout>();
  const isSubscribedRef = useRef(false);
  
  const dayStartRef = useRef<number>(
    new Date(new Date().toISOString().split('T')[0]).getTime()
  );
  
  const loadDailyHighs = async () => {
    try {
      const { data: dailyHighs, error: dailyHighsError } = await supabase
        .from('daily_highs')
        .select('*');

      if (dailyHighsError) throw dailyHighsError;

      const { data: lastAlerts, error: lastAlertsError } = await supabase
        .from('last_alerts')
        .select('*');

      if (lastAlertsError) throw lastAlertsError;

      dayHighsRef.current = new Map(
        dailyHighs?.map(({ symbol, high_of_day, timestamp, initial_price }) => [
          symbol,
          { high_of_day, timestamp, initialPrice: initial_price }
        ]) || []
      );

      lastAlertRef.current = new Map(
        lastAlerts?.map(({ symbol, timestamp }) => [symbol, timestamp]) || []
      );
    } catch (error) {
      console.error('Error loading daily highs:', error);
    }
  };

  const isNewDay = async (now: number): Promise<boolean> => {
    const currentUtcDayStart = new Date(
      new Date(now).toISOString().split('T')[0]
    ).getTime();

    if (currentUtcDayStart > dayStartRef.current) {
      dayHighsRef.current.clear();
      lastAlertRef.current.clear();
      dayStartRef.current = currentUtcDayStart;

      try {
        await supabase.from('daily_highs').delete().neq('symbol', '');
        await supabase.from('last_alerts').delete().neq('symbol', '');
      } catch (error) {
        console.error('Error clearing daily data:', error);
      }

      return true;
    }
    return false;
  };

  const updateDailyHigh = async (
    symbol: string,
    high_of_day: number,
    timestamp: number,
    initialPrice: number
  ) => {
    try {
      const { error } = await supabase
        .from('daily_highs')
        .upsert({
          symbol,
          high_of_day,
          timestamp,
          initial_price: initialPrice
        }, {
          onConflict: 'symbol'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating daily high:', error);
    }
  };

  const updateLastAlert = async (symbol: string, timestamp: number) => {
    try {
      const { error } = await supabase
        .from('last_alerts')
        .upsert({
          symbol,
          timestamp
        }, {
          onConflict: 'symbol'
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating last alert:', error);
    }
  };

  const calculateMomentumMetrics = async (
    newData: CoinData[],
    previousData: CoinData[]
  ): Promise<CoinData[]> => {
    const now = Date.now();
    const isNewUtcDay = await isNewDay(now);
    const minAlertInterval = 5 * 60 * 1000; // 5 minutes between alerts
    
    return Promise.all(newData.map(async (coin) => {
      const dayHighData = dayHighsRef.current.get(coin.symbol);
      const lastAlert = lastAlertRef.current.get(coin.symbol) || 0;
      
      let is_new_high = false;
      let high_of_day = dayHighData?.high_of_day || coin.current_price;
      let initialPrice = coin.current_price;
      
      if (!dayHighData || isNewUtcDay) {
        // Initialize new day data
        dayHighsRef.current.set(coin.symbol, {
          high_of_day: coin.current_price,
          timestamp: now,
          initialPrice: coin.current_price
        });
        
        await updateDailyHigh(
          coin.symbol,
          coin.current_price,
          now,
          coin.current_price
        );
      } else {
        initialPrice = dayHighData.initialPrice;
        
        // Check if current price is a new high
        if (coin.current_price > dayHighData.high_of_day) {
          high_of_day = coin.current_price;
          const priceIncrease = ((coin.current_price - initialPrice) / initialPrice) * 100;
          
          // Alert if price increase is significant and enough time has passed
          if (priceIncrease >= 2 && now - lastAlert >= minAlertInterval) {
            is_new_high = true;
            lastAlertRef.current.set(coin.symbol, now);
            await updateLastAlert(coin.symbol, now);
          }
          
          // Update daily high
          dayHighsRef.current.set(coin.symbol, {
            high_of_day: coin.current_price,
            timestamp: now,
            initialPrice: dayHighData.initialPrice
          });
          
          await updateDailyHigh(
            coin.symbol,
            coin.current_price,
            now,
            dayHighData.initialPrice
          );
        }
      }
      
      const prevCoin = previousData.find(p => p.symbol === coin.symbol);
      const baseVolume = prevCoin?.total_volume || 0;
      
      let price_change_5m = 0;
      let volume_ratio = 1;
      
      if (prevCoin && baseVolume > 0) {
        price_change_5m = ((coin.current_price - prevCoin.current_price) / prevCoin.current_price) * 100;
        volume_ratio = coin.total_volume / baseVolume;
      }
      
      return {
        ...coin,
        price_change_5m,
        volume_ratio,
        last_update: new Date(now),
        is_new_high,
        previousPrice: prevCoin?.current_price,
        day_high: high_of_day,
        initial_price: initialPrice
      };
    }));
  };

  const fetchData = async () => {
    try {
      const newData = await fetchCoinData();
      
      const dataWithMomentum = await calculateMomentumMetrics(
        newData,
        previousDataRef.current
      );
      
      previousDataRef.current = newData;
      
      setState({
        isLoading: false,
        error: null,
        data: dataWithMomentum
      });

      // Schedule next update
      fetchTimeoutRef.current = setTimeout(fetchData, REFRESH_INTERVAL);
    } catch (error) {
      console.error('Error fetching data:', error);
      setState(prev => ({
        isLoading: false,
        error: error instanceof Error ? error.message : 'An unknown error occurred',
        data: prev.data // Keep previous data on error
      }));

      // Retry after error with exponential backoff
      fetchTimeoutRef.current = setTimeout(fetchData, REFRESH_INTERVAL * 2);
    }
  };

  const setupRealtimeSubscription = () => {
    if (isSubscribedRef.current) return;

    const subscription = supabase
      .channel('running_up_alerts')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'running_up_alerts'
      }, () => {
        // Trigger a data refresh when new alerts are inserted
        fetchData();
      })
      .subscribe();

    isSubscribedRef.current = true;

    return () => {
      subscription.unsubscribe();
      isSubscribedRef.current = false;
    };
  };

  useEffect(() => {
    loadDailyHighs().then(() => {
      fetchData();
      setupRealtimeSubscription();
    });

    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
      dayHighsRef.current.clear();
      lastAlertRef.current.clear();
    };
  }, []);

  return state;
};