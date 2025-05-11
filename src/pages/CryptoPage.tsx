import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import CryptoTable from '../components/CryptoTable';
import MomentumScanner from '../components/MomentumScanner';
import TradingViewWidget from '../components/TradingViewWidget';
import { useCryptoData } from '../hooks/useCryptoData';

function CryptoPage() {
  const { data, isLoading, error } = useCryptoData();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BINANCE:BTCUSDT');
  
  useEffect(() => {
    if (!isLoading && data.length > 0) {
      setLastUpdated(new Date());
    }
  }, [data, isLoading]);

  const handleSymbolClick = (symbol: string) => {
    const formattedSymbol = symbol.toUpperCase();
    const tradingViewSymbol = `BINANCE:${formattedSymbol}USDT`;
    setSelectedSymbol(tradingViewSymbol);
  };

  return (
    <div className="max-w-7xl mx-auto">
      <Header lastUpdated={lastUpdated} isLoading={isLoading} />
      
      <main className="py-6 space-y-8">
        {/* TradingView Charts Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4 px-4">
            Market Charts
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4">
            <div className="overflow-hidden rounded-lg border border-gray-700 shadow-lg bg-gray-800" style={{ aspectRatio: '16/9' }}>
              <TradingViewWidget 
                symbol={selectedSymbol} 
                interval="1"
                studies={['VWAP@tv-basicstudies']}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-700 shadow-lg bg-gray-800" style={{ aspectRatio: '16/9' }}>
              <TradingViewWidget 
                symbol={selectedSymbol} 
                interval="5"
                studies={['VWAP@tv-basicstudies']}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-700 shadow-lg bg-gray-800" style={{ aspectRatio: '16/9' }}>
              <TradingViewWidget 
                symbol={selectedSymbol} 
                interval="60"
                studies={['VWAP@tv-basicstudies']}
              />
            </div>
            <div className="overflow-hidden rounded-lg border border-gray-700 shadow-lg bg-gray-800" style={{ aspectRatio: '16/9' }}>
              <TradingViewWidget 
                symbol={selectedSymbol} 
                interval="D"
                studies={['VWAP@tv-basicstudies']}
              />
            </div>
          </div>
        </div>

        {/* Momentum Scanner */}
        <div>
          <h2 className="text-xl font-semibold mb-4 px-4">
            Momentum Scanner (5m, 2x Vol)
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-700 shadow-lg">
            <MomentumScanner data={data} onSymbolClick={handleSymbolClick} />
          </div>
        </div>

        {/* Main Crypto Table */}
        <div>
          <h2 className="text-xl font-semibold mb-4 px-4">
            All Assets
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-700 shadow-lg">
            <CryptoTable 
              data={data} 
              isLoading={isLoading} 
              error={error}
              onSymbolClick={handleSymbolClick}
            />
          </div>
        </div>
        
        <p className="text-center text-sm text-gray-500 mt-6">
          Data refreshes automatically every 5 seconds. Sorted by 24h % change.
        </p>
      </main>
    </div>
  );
}

export default CryptoPage;