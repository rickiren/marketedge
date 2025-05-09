import React, { useState, useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { CoinData } from '../types';
import CryptoRow from './CryptoRow';

interface CryptoTableProps {
  data: CoinData[];
  isLoading: boolean;
  error: string | null;
  onSymbolClick: (symbol: string) => void;
}

const CryptoTable: React.FC<CryptoTableProps> = ({ data, isLoading, error, onSymbolClick }) => {
  const [sortedData, setSortedData] = useState<CoinData[]>([]);
  
  useEffect(() => {
    if (data.length > 0) {
      // Create a Map to store unique coins by symbol, keeping the latest entry
      const uniqueCoins = new Map();
      data.forEach(coin => {
        uniqueCoins.set(coin.symbol, coin);
      });
      
      // Convert Map values back to array and sort by percentage change
      const deduplicatedData = Array.from(uniqueCoins.values());
      const sorted = deduplicatedData.sort(
        (a, b) => b.price_change_percentage_24h - a.price_change_percentage_24h
      );
      
      setSortedData(sorted);
    }
  }, [data]);
  
  if (error) {
    return (
      <div className="flex items-center justify-center p-8 rounded-lg bg-red-900/20 border border-red-700 my-6 mx-4">
        <AlertTriangle className="text-red-500 mr-3" />
        <p className="text-red-400">Error loading data: {error}</p>
      </div>
    );
  }
  
  return (
    <div className="overflow-x-auto">
      <table className="w-full divide-y divide-gray-700">
        <thead className="bg-gray-800/50">
          <tr>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              #
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Asset
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Price
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              24h %
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              24h Volume
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Market Cap
            </th>
            <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700 bg-gray-800/20">
          {isLoading && sortedData.length === 0 ? (
            Array.from({ length: 10 }).map((_, index) => (
              <tr key={`skeleton-${index}`} className="animate-pulse">
                <td className="py-4 px-4"><div className="h-4 bg-gray-700 rounded w-6"></div></td>
                <td className="py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-gray-700 rounded-full"></div>
                    <div className="flex flex-col gap-1">
                      <div className="h-4 bg-gray-700 rounded w-16"></div>
                      <div className="h-3 bg-gray-700 rounded w-24"></div>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-700 rounded w-20"></div></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-700 rounded w-14"></div></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-700 rounded w-24"></div></td>
                <td className="py-4 px-4"><div className="h-4 bg-gray-700 rounded w-24"></div></td>
                <td className="py-4 px-4"><div className="h-8 bg-gray-700 rounded w-20"></div></td>
              </tr>
            ))
          ) : (
            sortedData.map((coin, index) => (
              <CryptoRow 
                key={`${coin.symbol}-${coin.id}`} 
                coin={coin} 
                index={index}
                onSymbolClick={onSymbolClick}
              />
            ))
          )}
        </tbody>
      </table>
      
      {!isLoading && sortedData.length === 0 && !error && (
        <div className="flex items-center justify-center p-8">
          <p className="text-gray-400">No data available</p>
        </div>
      )}
    </div>
  );
};

export default CryptoTable