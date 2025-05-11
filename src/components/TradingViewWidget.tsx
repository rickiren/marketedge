import React, { useEffect, useRef, memo, useState } from 'react';

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
  studies = []
}: TradingViewWidgetProps) {
  const container = useRef<HTMLDivElement>(null);
  const [widgetInstance, setWidgetInstance] = useState<any>(null);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const containerId = useRef(`tradingview_${Math.random().toString(36).substring(7)}`);
  const [isSymbolValid, setIsSymbolValid] = useState(true);

  const checkSymbolValidity = async (symbolToCheck: string): Promise<boolean> => {
    try {
      const exchange = symbolToCheck.split(':')[0];
      const pair = symbolToCheck.split(':')[1];
      
      const response = await fetch(`https://symbol-search.tradingview.com/symbol_search/?text=${exchange}:${pair}`);
      const data = await response.json();
      
      return data.some((item: any) => 
        item.symbol === pair && 
        item.exchange === exchange.toLowerCase()
      );
    } catch (error) {
      console.warn('Error checking symbol validity:', error);
      return false;
    }
  };

  const getAlternativeSymbol = (originalSymbol: string): string => {
    const pair = originalSymbol.split(':')[1];
    return `BYBIT:${pair}`;
  };

  useEffect(() => {
    let isMounted = true;
    let currentAttemptSymbol = symbol;

    const createWidget = async () => {
      if (!container.current || !isMounted) return;

      // Clear existing widget
      if (container.current?.parentNode) {
        container.current.innerHTML = '';
      }

      // Check if the current symbol is valid
      const isValid = await checkSymbolValidity(currentAttemptSymbol);
      
      if (!isValid && currentAttemptSymbol.startsWith('BINANCE:')) {
        // Try Bybit
        const bybitSymbol = getAlternativeSymbol(currentAttemptSymbol);
        const isBybitValid = await checkSymbolValidity(bybitSymbol);
        
        if (isBybitValid) {
          currentAttemptSymbol = bybitSymbol;
        }
      }

      setIsSymbolValid(true);

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
        symbol: currentAttemptSymbol,
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
          if (isMounted) {
            setIsSymbolValid(false);
          }
        }
      });

      if (isMounted) {
        setWidgetInstance(widget);
        setCurrentSymbol(currentAttemptSymbol);
      }
    };

    // Load TradingView script if not already loaded
    if (!window.TradingView) {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.async = true;
      script.onload = createWidget;
      document.head.appendChild(script);
    } else {
      createWidget();
    }

    return () => {
      isMounted = false;
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
  }, [symbol, interval, studies, theme]);

  if (!isSymbolValid) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-800 text-gray-400 text-sm">
        No data available for this symbol
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