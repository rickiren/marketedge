import { CoinData, CryptoCompareResponse, HistoricalDataPoint, NewsArticle } from '../types';
import { COIN_PAIRS } from '../utils/constants';
import { supabase } from '../lib/supabase';
import { calculateVolumeMetrics } from '../utils/formatting';

const CRYPTOCOMPARE_API_KEY = 'c37ed2e6d68271c5d3f0e04f34d9caf64bd329766b3c99a4d52eeaf342e65a8b';
const BASE_URL = 'https://min-api.cryptocompare.com';
const IMAGE_BASE_URL = 'https://www.cryptocompare.com';
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;

async function fetchWithRetry(url: string, options: RequestInit, retries = MAX_RETRIES): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response;
    } catch (error) {
      lastError = error;
      console.warn(`Attempt ${attempt}/${retries} failed for URL: ${url}`, error.message);
      if (attempt === retries) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt - 1)));
    }
  }
  throw new Error(`Failed to fetch after ${retries} attempts: ${lastError?.message}`);
}

async function fetchNewsForCoin(symbol: string): Promise<NewsArticle[]> {
  try {
    const url = new URL(`${BASE_URL}/data/v2/news/`);
    url.search = new URLSearchParams({
      categories: symbol.toLowerCase(),
      excludeCategories: 'Sponsored',
      lang: 'EN',
      sortOrder: 'latest',
      feeds: 'cryptocompare,cointelegraph,coindesk',
      extraParams: 'CryptoTopGainers'
    }).toString();

    const response = await fetchWithRetry(url.toString(), {
      headers: {
        'authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}`,
        'Accept': 'application/json',
      }
    });

    const data = await response.json();
    
    if (data.Response === 'Error') {
      throw new Error(data.Message);
    }

    if (!data.Data || !Array.isArray(data.Data)) {
      return [];
    }

    // Filter articles from the last 24 hours
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return data.Data
      .filter((article: any) => article.published_on * 1000 > oneDayAgo)
      .map((article: any) => ({
        id: article.id,
        title: article.title,
        body: article.body,
        url: article.url,
        source: article.source,
        published_at: article.published_on,
        categories: article.categories.split('|')
      }));
  } catch (error) {
    console.error(`Error fetching news for ${symbol}:`, error);
    return [];
  }
}

async function insertRunningUpAlert(coin: CoinData, retries = 3): Promise<void> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { error } = await supabase
        .from('running_up_alerts')
        .insert({
          symbol: coin.symbol,
          price: coin.current_price,
          volume: coin.total_volume,
          timestamp: new Date().toISOString()
        });

      if (error) {
        throw error;
      }
      return;
    } catch (error) {
      lastError = error;
      console.warn(`Retrying insert for ${coin.symbol}, attempt ${attempt}/${retries}:`, error.message);
      if (attempt === retries) {
        break;
      }
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  console.error(`Failed to insert alert for ${coin.symbol} after ${retries} attempts:`, lastError);
}

async function fetchSupabaseRPCWithRetry<T>(
  functionName: string,
  params: Record<string, any>,
  retries = MAX_RETRIES
): Promise<T | null> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const { data, error } = await supabase
        .rpc(functionName, params)
        .maybeSingle();

      if (error) {
        throw error;
      }

      return data as T;
    } catch (error) {
      lastError = error;
      console.warn(
        `Attempt ${attempt}/${retries} failed for RPC function ${functionName}:`,
        error.message
      );
      if (attempt === retries) {
        break;
      }
      await new Promise(resolve => 
        setTimeout(resolve, RETRY_DELAY * Math.pow(2, attempt - 1))
      );
    }
  }

  console.error(
    `Failed to execute RPC function ${functionName} after ${retries} attempts:`,
    lastError
  );
  return null;
}

/**
 * Fetches coin data from CryptoCompare API
 */
export const fetchCoinData = async (): Promise<CoinData[]> => {
  try {
    const symbols = COIN_PAIRS.map(pair => pair.split('/')[0]);
    const fsyms = symbols.join(',');
    
    const url = new URL(`${BASE_URL}/data/pricemultifull`);
    url.search = new URLSearchParams({
      fsyms,
      tsyms: 'USD'
    }).toString();
    
    const response = await fetchWithRetry(url.toString(), {
      headers: {
        'authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}`,
        'Accept': 'application/json',
      }
    });

    const data: CryptoCompareResponse = await response.json();
    
    if (data.Response === 'Error') {
      throw new Error(data.Message);
    }

    if (!data.RAW) {
      throw new Error('Invalid API response structure: missing RAW data');
    }

    const coins = await Promise.all(symbols.map(async (symbol) => {
      try {
        if (!data.RAW[symbol]?.USD) {
          console.warn(`Missing or invalid data for ${symbol}, skipping...`);
          return null;
        }

        const coinData = data.RAW[symbol].USD;
        const newsArticles = await fetchNewsForCoin(symbol);
        
        const coin = {
          id: symbol.toLowerCase(),
          symbol: symbol,
          name: symbol,
          image: `${IMAGE_BASE_URL}${coinData.IMAGEURL}`,
          current_price: coinData.PRICE,
          high_24h: coinData.HIGH24HOUR,
          price_change_percentage_24h: coinData.CHANGEPCT24HOUR,
          total_volume: coinData.VOLUME24HOUR,
          market_cap: coinData.MKTCAP,
          hasNews: newsArticles.length > 0,
          newsArticles: newsArticles
        };

        if (!isValidCoinData(coin)) {
          console.warn(`Invalid data structure for ${symbol}, skipping...`);
          return null;
        }

        return coin;
      } catch (error) {
        console.error(`Error processing coin data for ${symbol}:`, error);
        return null;
      }
    }));

    const validCoins = coins.filter((coin): coin is CoinData => coin !== null);

    const processedCoins = await Promise.all(
      validCoins.map(async (coin) => {
        try {
          // Fetch historical hourly data for volume analysis
          const historicalData = await fetchHistoricalData(coin.symbol);
          
          if (!historicalData || historicalData.length === 0) {
            console.warn(`No historical data available for ${coin.symbol}, skipping volume metrics`);
            return {
              ...coin,
              price_change_5m: 0,
              volume_ratio: 1,
              relative_volume: 1,
              spike_factor: 1
            };
          }

          const volumes = historicalData.map(d => d.volumeto);
          const currentVolume = volumes[0] || 0;
          const previousVolume = volumes[1] || 0;
          
          // Calculate volume metrics
          const { relativeVolume, spikeFactor } = calculateVolumeMetrics(
            currentVolume,
            previousVolume,
            volumes
          );

          // Get 5-minute price change
          const priceChange = await fetchSupabaseRPCWithRetry<number>(
            'get_price_change_percentage',
            {
              p_symbol: coin.symbol,
              p_minutes: 5
            }
          ) ?? 0;

          // Only insert alert if both volume and price conditions are met
          if (relativeVolume >= 5 && spikeFactor >= 1.5 && priceChange >= 5) {
            await insertRunningUpAlert(coin);
          }

          return {
            ...coin,
            price_change_5m: priceChange,
            volume_ratio: 1,
            relative_volume: relativeVolume,
            spike_factor: spikeFactor
          };
        } catch (error) {
          console.error(`Error processing extended data for ${coin.symbol}:`, error);
          return {
            ...coin,
            price_change_5m: 0,
            volume_ratio: 1,
            relative_volume: 1,
            spike_factor: 1
          };
        }
      })
    );

    return processedCoins;
  } catch (error) {
    console.error('Error fetching coin data:', error);
    throw new Error(`Failed to fetch cryptocurrency data: ${error.message}`);
  }
};

function isValidCoinData(coin: CoinData): boolean {
  return (
    coin &&
    typeof coin.symbol === 'string' &&
    typeof coin.current_price === 'number' &&
    !isNaN(coin.current_price) &&
    coin.current_price > 0 &&
    typeof coin.total_volume === 'number' &&
    !isNaN(coin.total_volume) &&
    coin.total_volume > 0 &&
    typeof coin.high_24h === 'number' &&
    !isNaN(coin.high_24h) &&
    typeof coin.price_change_percentage_24h === 'number' &&
    !isNaN(coin.price_change_percentage_24h)
  );
}

/**
 * Fetches historical hourly data for a given symbol
 */
export const fetchHistoricalData = async (symbol: string): Promise<HistoricalDataPoint[]> => {
  try {
    const url = new URL(`${BASE_URL}/data/v2/histohour`);
    url.search = new URLSearchParams({
      fsym: symbol,
      tsym: 'USD',
      limit: '12', // Last 12 hours for SMA calculation
    }).toString();

    const response = await fetchWithRetry(url.toString(), {
      headers: {
        'authorization': `Apikey ${CRYPTOCOMPARE_API_KEY}`,
        'Accept': 'application/json',
      }
    });

    const data = await response.json();

    if (data.Response === 'Error') {
      console.warn(`Error fetching historical data for ${symbol}:`, data.Message);
      return [];
    }

    if (!data.Data?.Data || !Array.isArray(data.Data.Data)) {
      console.warn(`Invalid historical data structure for ${symbol}`);
      return [];
    }

    return data.Data.Data;
  } catch (error) {
    console.error(`Error fetching historical data for ${symbol}:`, error);
    return [];
  }
};