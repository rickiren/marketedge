import React, { useEffect, useRef, memo, useState, useCallback } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import QuickLRU from 'quick-lru';

interface TradingViewWidgetProps {
  symbol?: string;
  theme?: 'light' | 'dark';
  interval?: string;
  studies?: string[];
}

// Prioritized list of exchanges to try
const EXCHANGES = ['BINANCE', 'BYBIT', 'COINBASE', 'KRAKEN', 'KUCOIN'];
const DEFAULT_SYMBOL = 'BINANCE:BTCUSDT';

// Cache for symbol validation results (100 entries, 5 minute TTL)
const symbolCache = new QuickLRU<string, boolean>({ 
  maxSize: 100,
  maxAge: 1000 * 60 * 5 
});

function TradingViewWidget({ 
  symbol = DEFAULT_SYMBOL,
  theme = 'dark',
  interval = '5',
  studies = []
}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const [widgetInstance, setWidgetInstance] = useState<any>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const containerId = useRef(`tradingview_${Math.random().toString(36).substring(7)}`);
  const [isSymbolValid, setIsSymbolValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout>();

  const checkSymbolValidity = useCallback(async (symbolToCheck: string, retries = 3): Promise<boolean> => {
    // Check cache first
    const cachedResult = symbolCache.get(symbolToCheck);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const [exchange, pair] = symbolToCheck.split(':');
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await fetch(
          `https://symbol-search.tradingview.com/symbol_search/?text=${exchange}:${pair}`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        const isValid = data.some((item: any) => 
          item.symbol === pair && 
          item.exchange === exchange.toLowerCase()
        );

        // Cache the result
        symbolCache.set(symbolToCheck, isValid);
        return isValid;
      } catch (error) {
        if (attempt === retries) {
          console.error(`Symbol validation failed after ${retries} attempts:`, error);
          return false;
        }
        // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
    
    return false;
  }, []);

  const findValidExchange = useCallback(async (pair: string): Promise<string | null> => {
    for (const exchange of EXCHANGES) {
      const symbolToCheck = `${exchange}:${pair}`;
      if (await checkSymbolValidity(symbolToCheck)) {
        return symbolToCheck;
      }
    }
    return null;
  }, [checkSymbolValidity]);

  const createWidget = useCallback(async (symbolToUse: string) => {
    if (!container.current) return;

    // Clear existing widget
    if (container.current?.parentNode) {
      container.current.innerHTML = '';
    }

    const defaultStudies = [
      'MASimple@tv-basicstudies',
      'VWAP@tv-basicstudies',
      'MACD@tv-basicstudies'
    ];

    const widget = new window.TradingView.widget({
      autosize: true,
      container_id: containerId.current,
      width: '100%',
      height: '100%',
      symbol: symbolToUse,
      interval: interval,
      timezone: 'Etc/UTC',
      theme: theme,
      style: '1',
      locale: 'en',
      toolbar_bg: '#f1f3f6',
      enable_publishing: false,
      allow_symbol_change: true,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: false,
      studies: [...defaultStudies, ...studies].map(study => ({
        id: study,
        version: 1,
        inputs: {
          length: study === 'MACD@tv-basicstudies' ? 26 : 20,
          source: 'close',
          fastLength: 12,
          slowLength: 26,
          signalLength: 9,
        },
        styles: {
          plot_0: {
            color: '#2962FF',
            linewidth: 2,
          }
        }
      })),
      onNoDataAvailable: () => {
        setIsSymbolValid(false);
        setError('No data available for this symbol');
      }
    });

    setWidgetInstance(widget);
    setCurrentSymbol(symbolToUse);
  }, [interval, studies, theme]);

  const initializeWidget = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      let symbolToUse = symbol;
      const [, pair] = symbol.split(':');

      // Check if the current symbol is valid
      const isValid = await checkSymbolValidity(symbol);
      
      if (!isValid) {
        // Try to find a valid exchange for the pair
        const validSymbol = await findValidExchange(pair);
        
        if (validSymbol) {
          symbolToUse = validSymbol;
        } else {
          // Fall back to default symbol if no valid exchange found
          symbolToUse = DEFAULT_SYMBOL;
          setError(`Symbol ${symbol} not available. Falling back to ${DEFAULT_SYMBOL}`);
        }
      }

      await createWidget(symbolToUse);
      setIsSymbolValid(true);
    } catch (error) {
      console.error('Widget initialization error:', error);
      setError('Failed to initialize chart. Retrying...');
      
      // Retry initialization after 5 seconds
      retryTimeoutRef.current = setTimeout(initializeWidget, 5000);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, checkSymbolValidity, findValidExchange, createWidget]);

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      // Load TradingView script if not already loaded
      if (!window.TradingView) {
        const script = document.createElement('script');
        script.src = 'https://s3.tradingview.com/tv.js';
        script.async = true;
        script.onload = () => {
          if (isMounted) {
            initializeWidget();
          }
        };
        document.head.appendChild(script);
      } else {
        initializeWidget();
      }
    };

    setup();

    return () => {
      isMounted = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (widgetInstance) {
        try {
          if (container.current?.parentNode) {
            container.current.innerHTML = '';
          }
          if (widgetInstance?.remove && typeof widgetInstance.remove === 'function') {
            widgetInstance.remove();
          }
          setWidgetInstance(null);
        } catch (e) {
          console.error('Error cleaning up TradingView widget:', e);
        }
      }
    };
  }, [symbol, interval, studies, theme, initializeWidget]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading chart...</span>
      </div>
    );
  }

  if (!isSymbolValid || error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800 text-gray-400 p-4">
        <AlertCircle className="w-8 h-8 mb-2 text-yellow-500" />
        <p className="text-center mb-4">{error || 'No data available for this symbol'}</p>
        <button
          onClick={initializeWidget}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Retry
        </button>
      </div>
    );
  }

  return (
    <div 
      id={containerId.current}
      ref={container}
      style={{ width: '100%', height: '100%' }}
    />
  );
}

// Prevent unnecessary re-renders
export default memo(TradingViewWidget, (prevProps, nextProps) => {
  return (
    prevProps.symbol === nextProps.symbol &&
    prevProps.interval === nextProps.interval &&
    prevProps.theme === nextProps.theme &&
    JSON.stringify(prevProps.studies) === JSON.stringify(nextProps.studies)
  );
});

declare global {
  interface Window {
    TradingView: any;
  }
}