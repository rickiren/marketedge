import React, { useEffect, useRef, memo, useState, useCallback } from 'react';

// Cache for symbol validation results
const symbolCache = new Map<string, boolean>();

interface TradingViewWidgetProps {
  symbol?: string;
  theme?: 'light' | 'dark';
  interval?: string;
  studies?: string[];
}

function TradingViewWidget({
  symbol = 'BINANCE:BTCUSDT',
  theme = 'dark',
  interval = '5',
  studies = [],
}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const [widgetInstance, setWidgetInstance] = useState<any>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [containerId] = useState(`tradingview_${Math.random().toString(36).substring(7)}`);
  const [isSymbolValid, setIsSymbolValid] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // List of exchanges to try, in order of preference
  const exchangePriority = ['BINANCE', 'BYBIT', 'KRAKEN', 'COINBASE'];
  const defaultFallbackSymbol = 'BINANCE:BTCUSDT';

  // Check symbol validity with retry logic
  const checkSymbolValidity = useCallback(
    async (symbolToCheck: string, retries = 2): Promise<boolean> => {
      if (symbolCache.has(symbolToCheck)) {
        return symbolCache.get(symbolToCheck)!;
      }

      try {
        const pair = symbolToCheck.split(':')[1] || '';
        // Query TradingView's symbol search API for all exchanges
        const response = await fetch(
          `https://symbol-search.tradingview.com/symbol_search/?text=${pair}&exchange=`,
          { headers: { 'Content-Type': 'application/json' } }
        );

        if (!response.ok) {
          if (retries > 0) {
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return checkSymbolValidity(symbolToCheck, retries - 1);
          }
          throw new Error('API request failed');
        }

        const data = await response.json();
        const isValid = data.some((item: any) =>
          exchangePriority.includes(item.exchange.toUpperCase()) && item.symbol === pair
        );

        symbolCache.set(symbolToCheck, isValid);
        return isValid;
      } catch (error) {
        console.warn(`Error checking symbol ${symbolToCheck}:`, error);
        if (retries > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          return checkSymbolValidity(symbolToCheck, retries - 1);
        }
        symbolCache.set(symbolToCheck, false);
        return false;
      }
    },
    []
  );

  // Find a valid symbol across exchanges
  const findValidSymbol = useCallback(
    async (baseSymbol: string): Promise<string> => {
      const pair = baseSymbol.split(':')[1] || '';
      // Try the original symbol first
      if (await checkSymbolValidity(baseSymbol)) {
        return baseSymbol;
      }

      // Try other exchanges
      for (const exchange of exchangePriority) {
        const testSymbol = `${exchange}:${pair}`;
        if (testSymbol !== baseSymbol && (await checkSymbolValidity(testSymbol))) {
          return testSymbol;
        }
      }

      // Fall back to default symbol
      return defaultFallbackSymbol;
    },
    [checkSymbolValidity]
  );

  useEffect(() => {
    let isMounted = true;

    const createWidget = async () => {
      if (!container.current || !isMounted) return;

      setIsLoading(true);
      setError(null);

      // Clear existing widget
      container.current.innerHTML = '';

      // Find a valid symbol
      const validSymbol = await findValidSymbol(symbol);
      const isValid = await checkSymbolValidity(validSymbol);

      if (!isMounted) return;

      if (!isValid) {
        setIsSymbolValid(false);
        setError(`No valid data found for ${symbol}. Showing ${validSymbol} instead.`);
        setIsLoading(false);
        return;
      }

      setIsSymbolValid(true);

      const defaultStudies = [
        'MASimple@tv-basicstudies',
        'VWAP@tv-basicstudies',
        'MACD@tv-basicstudies',
      ];

      try {
        const widget = new window.TradingView.widget({
          autosize: true,
          container_id: containerId,
          width: '100%',
          height: '100%',
          symbol: validSymbol,
          interval,
          timezone: 'Etc/UTC',
          theme,
          style: '1',
          locale: 'en',
          toolbar_bg: '#f1f3f6',
          enable_publishing: false,
          allow_symbol_change: true,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: false,
          studies: [...defaultStudies, ...studies].map((study) => ({
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
              plot_0: { color: '#2962FF', linewidth: 2 },
            },
          })),
          onNoDataAvailable: () => {
            if (isMounted) {
              setIsSymbolValid(false);
              setError(`No data available for ${validSymbol}`);
            }
          },
        });

        if (isMounted) {
          setWidgetInstance(widget);
          setCurrentSymbol(validSymbol);
        }
      } catch (e) {
        console.error('Error creating TradingView widget:', e);
        setError('Failed to load chart. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };

    // Load TradingView script if not already loaded
    if (!window.TradingView) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      script.onerror = () => {
        setError('Failed to load TradingView script.');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    } else {
      createWidget();
    }

    return () => {
      isMounted = false;
      if (widgetInstance) {
        try {
          container.current!.innerHTML = '';
          if (widgetInstance?.remove && typeof widgetInstance.remove === 'function') {
            widgetInstance.remove();
          }
          setWidgetInstance(null);
        } catch (e) {
          console.error('Error cleaning up TradingView widget:', e);
        }
      }
    };
  }, [symbol, interval, studies, theme, findValidSymbol]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400 text-sm">
        Loading chart...
      </div>
    );
  }

  if (!isSymbolValid || error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-800 text-gray-400 text-sm p-4">
        <p>{error || 'No data available for this symbol'}</p>
        <button
          className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          onClick={() => setCurrentSymbol(defaultFallbackSymbol)}
        >
          Try Default Symbol
        </button>
      </div>
    );
  }

  return (
    <div
      id={containerId}
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