import React, { useState, useEffect } from 'react';
import { usePolygonStream } from '../hooks/usePolygonStream';
import { Activity, ArrowUp, ArrowDown } from 'lucide-react';
import { formatCurrency, formatPercentage, formatLargeNumber } from '../utils/formatting';

function PolygonPage() {
  const { data, isConnected } = usePolygonStream();
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    if (data.length > 0) {
      setLastUpdated(new Date());
    }
  }, [data]);

  return (
    <div className="max-w-7xl mx-auto">
      <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-gray-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 p-2 rounded-lg">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Top 100 by Market Cap</h1>
              <p className="text-gray-400 text-sm">
                Real-time cryptocurrency data via Polygon.io
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${
              isConnected ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-400' : 'bg-red-400'
              }`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
            {lastUpdated && (
              <span className="text-sm text-gray-400">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      </header>
      
      <main className="py-6">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-700">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">#</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Symbol</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Change</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Market Cap</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Volume</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">VWAP</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800/20">
              {data.map((item, index) => (
                <tr key={item.pair} className="hover:bg-gray-800/50">
                  <td className="py-4 px-4 text-gray-400">{index + 1}</td>
                  <td className="py-4 px-4 font-medium text-white">{item.pair}</td>
                  <td className="py-4 px-4">{formatCurrency(item.price)}</td>
                  <td className={`py-4 px-4 ${item.priceChange > 0 ? 'text-green-500' : 'text-red-500'}`}>
                    <div className="flex items-center gap-1">
                      {item.priceChange > 0 ? (
                        <ArrowUp className="w-4 h-4" />
                      ) : (
                        <ArrowDown className="w-4 h-4" />
                      )}
                      {formatPercentage(item.priceChange)}
                    </div>
                  </td>
                  <td className="py-4 px-4 text-gray-300">
                    {item.marketCap ? formatLargeNumber(item.marketCap) : '-'}
                  </td>
                  <td className="py-4 px-4 text-gray-300">{formatLargeNumber(item.volume)}</td>
                  <td className="py-4 px-4 text-gray-300">{formatCurrency(item.vwap)}</td>
                  <td className="py-4 px-4 text-gray-400">
                    {new Date(item.timestamp).toLocaleTimeString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {data.length === 0 && (
            <div className="text-center py-8 text-gray-400">
              Waiting for data...
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default PolygonPage;