import React from 'react';
import { TrendingUp, RefreshCw } from 'lucide-react';

interface HeaderProps {
  lastUpdated: Date | null;
  isLoading: boolean;
}

const Header: React.FC<HeaderProps> = ({ lastUpdated, isLoading }) => {
  return (
    <header className="py-6 px-4 sm:px-6 lg:px-8 border-b border-gray-800">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <TrendingUp className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Crypto Top Gainers</h1>
            <p className="text-gray-400 text-sm">
              Real-time data of the top performing cryptocurrencies
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-500' : ''}`} />
          <span>
            {lastUpdated 
              ? `Last updated: ${lastUpdated.toLocaleTimeString()}`
              : 'Updating...'}
          </span>
        </div>
      </div>
    </header>
  );
};

export default Header;