import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Search } from 'lucide-react';
import { CoinData } from '../types';
import { 
  formatCurrency, 
  formatPercentage, 
  formatLargeNumber,
  getPercentageClass,
  getPriceChangeClass
} from '../utils/formatting';
import GrokAnalysisModal from './GrokAnalysisModal';

interface CryptoRowProps {
  coin: CoinData;
  index: number;
  onSymbolClick: (symbol: string) => void;
}

const CryptoRow: React.FC<CryptoRowProps> = ({ coin, index, onSymbolClick }) => {
  const [highlight, setHighlight] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  
  useEffect(() => {
    if (coin.previousPrice && coin.previousPrice !== coin.current_price) {
      setHighlight(true);
      const timer = setTimeout(() => setHighlight(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [coin.current_price, coin.previousPrice]);
  
  const percentageClass = getPercentageClass(coin.price_change_percentage_24h);
  const priceChangeClass = getPriceChangeClass(coin.current_price, coin.previousPrice);
  
  const rowClass = `border-b border-gray-700 hover:bg-gray-800/50 ${
    highlight ? 'bg-opacity-20 bg-blue-900 transition-colors duration-500' : ''
  }`;
  
  return (
    <>
      <tr className={rowClass}>
        <td className="py-4 px-4 font-medium text-gray-300">
          {index + 1}
        </td>
        <td className="py-4 px-4">
          <div className="flex items-center gap-3">
            {coin.image && (
              <img 
                src={coin.image} 
                alt={coin.name} 
                className="w-6 h-6 rounded-full"
              />
            )}
            <div className="flex flex-col">
              <button
                onClick={() => onSymbolClick(coin.symbol)}
                className="font-medium text-white hover:underline text-left"
              >
                {coin.symbol.toUpperCase()}
              </button>
              <span className="text-xs text-gray-400">{coin.name}</span>
            </div>
          </div>
        </td>
        <td className={`py-4 px-4 font-medium ${priceChangeClass}`}>
          {formatCurrency(coin.current_price)}
        </td>
        <td className={`py-4 px-4 font-medium ${percentageClass}`}>
          <div className="flex items-center gap-1">
            {coin.price_change_percentage_24h > 0 ? (
              <ArrowUp className="w-4 h-4" />
            ) : coin.price_change_percentage_24h < 0 ? (
              <ArrowDown className="w-4 h-4" />
            ) : null}
            {formatPercentage(coin.price_change_percentage_24h)}
          </div>
        </td>
        <td className="py-4 px-4 text-gray-300">
          {formatCurrency(coin.total_volume)}
        </td>
        <td className="py-4 px-4 text-gray-300">
          {formatCurrency(coin.market_cap)}
        </td>
        <td className="py-4 px-4">
          <button
            onClick={() => setShowAnalysis(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm transition-colors"
          >
            <Search className="w-4 h-4" />
            Analyze
          </button>
        </td>
      </tr>

      <GrokAnalysisModal
        isOpen={showAnalysis}
        onClose={() => setShowAnalysis(false)}
        coin={coin.symbol}
        change={coin.price_change_percentage_24h}
      />
    </>
  );
};

export default CryptoRow;