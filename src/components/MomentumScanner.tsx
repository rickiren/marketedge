import React, { useState, useEffect } from 'react';
import { ArrowUp, ArrowDown, Sparkles, History, X, Volume2, VolumeX, TrendingUp } from 'lucide-react';
import { CoinData } from '../types';
import { formatCurrency, formatPercentage } from '../utils/formatting';
import { fetchHistoricalData } from '../services/api';
import { useSound } from '../hooks/useSound';

interface MomentumScannerProps {
  data: CoinData[];
  onSymbolClick: (symbol: string) => void;
}

interface Alert {
  id: string;
  symbol: string;
  price: number;
  priceChange?: number;
  volumeRatio?: number;
  isNewHigh: boolean;
  timestamp: Date;
  image?: string;
  price_change_percentage_24h?: number;
  relative_volume?: number;
  spike_factor?: number;
}

interface HistoricalAlert {
  symbol: string;
  timestamp: Date;
  price: number;
  priceChange: number;
  volumeRatio: number;
  isNewHigh: boolean;
  relative_volume?: number;
  spike_factor?: number;
}

const MomentumScanner: React.FC<MomentumScannerProps> = ({ data, onSymbolClick }) => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [historicalAlerts, setHistoricalAlerts] = useState<HistoricalAlert[]>([]);
  const [isBacktesting, setIsBacktesting] = useState(false);
  const [backtestProgress, setBacktestProgress] = useState(0);
  const { isMuted, playSound, toggleMute } = useSound();
  const [debugMode, setDebugMode] = useState(false);

  // Update alerts when new data comes in
  useEffect(() => {
    if (!data || data.length === 0) return;

    console.log('Processing new data for momentum alerts...');

    const newAlerts = data
      .filter(coin => {
        // Log conditions for debugging
        if (debugMode) {
          console.log(`${coin.symbol} conditions:`, {
            price_change_5m: coin.price_change_5m,
            volume_ratio: coin.volume_ratio,
            is_new_high: coin.is_new_high,
            relative_volume: coin.relative_volume,
            spike_factor: coin.spike_factor
          });
        }

        // Check for momentum conditions (5% price increase and 2x volume)
        const hasMomentum = coin.price_change_5m && 
                           coin.volume_ratio && 
                           coin.price_change_5m >= 5 && 
                           coin.volume_ratio >= 2;

        // Check for volume spike conditions
        const hasVolumeSpike = coin.relative_volume && 
                              coin.spike_factor && 
                              coin.price_change_5m &&
                              coin.relative_volume >= 5 && 
                              coin.spike_factor >= 1.5 && 
                              coin.price_change_5m >= 5;

        return hasMomentum || coin.is_new_high || hasVolumeSpike;
      })
      .map(coin => ({
        id: `${coin.symbol}-${Date.now()}`,
        symbol: coin.symbol,
        price: coin.current_price,
        priceChange: coin.price_change_5m,
        volumeRatio: coin.volume_ratio,
        isNewHigh: coin.is_new_high || false,
        timestamp: new Date(),
        image: coin.image,
        price_change_percentage_24h: coin.price_change_percentage_24h,
        relative_volume: coin.relative_volume,
        spike_factor: coin.spike_factor
      }));

    if (debugMode && newAlerts.length > 0) {
      console.log('New alerts generated:', newAlerts);
    }

    // Add new alerts that aren't already in the list
    setAlerts(prevAlerts => {
      const newUniqueAlerts = newAlerts.filter(newAlert => 
        !prevAlerts.some(existingAlert => 
          existingAlert.symbol === newAlert.symbol &&
          existingAlert.timestamp.getTime() > Date.now() - 300000 // 5 minutes
        )
      );
      
      if (newUniqueAlerts.length > 0) {
        console.log('Adding new unique alerts:', newUniqueAlerts);
        playSound();
      }
      
      // Combine with existing alerts and sort by timestamp
      return [...newUniqueAlerts, ...prevAlerts]
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 100); // Keep last 100 alerts
    });
  }, [data, playSound, debugMode]);

  // Clean up old alerts (older than 24 hours)
  useEffect(() => {
    const cleanup = setInterval(() => {
      const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;
      setAlerts(prevAlerts => 
        prevAlerts.filter(alert => alert.timestamp.getTime() > twentyFourHoursAgo)
      );
    }, 60000); // Check every minute

    return () => clearInterval(cleanup);
  }, []);

  const runBacktest = async () => {
    setIsBacktesting(true);
    setHistoricalAlerts([]);
    const alerts: HistoricalAlert[] = [];

    try {
      for (let i = 0; i < data.length; i++) {
        const coin = data[i];
        setBacktestProgress(Math.round((i / data.length) * 100));
        
        const historicalData = await fetchHistoricalData(coin.symbol);
        
        if (!historicalData || historicalData.length === 0) {
          console.warn(`No historical data available for ${coin.symbol}`);
          continue;
        }

        let dayHigh = -Infinity;
        let baseVolume = historicalData[0].volumeto || 0;

        for (let j = 1; j < historicalData.length; j++) {
          const current = historicalData[j];
          const prev = historicalData[j - 1];
          
          // Update day high
          if (current.close > dayHigh) {
            dayHigh = current.close;
            alerts.push({
              symbol: coin.symbol,
              timestamp: new Date(current.time * 1000),
              price: current.close,
              priceChange: 0,
              volumeRatio: 0,
              isNewHigh: true
            });
          }

          // Calculate metrics
          const priceChange = ((current.close - prev.close) / prev.close) * 100;
          const volumeRatio = current.volumeto / baseVolume;

          // Check for momentum alerts
          if (priceChange >= 5 && volumeRatio >= 2) {
            alerts.push({
              symbol: coin.symbol,
              timestamp: new Date(current.time * 1000),
              price: current.close,
              priceChange,
              volumeRatio,
              isNewHigh: false
            });
          }

          // Update base volume for next comparison
          baseVolume = current.volumeto;
        }
      }

      // Sort alerts by timestamp (most recent first)
      alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      setHistoricalAlerts(alerts);
    } catch (error) {
      console.error('Backtest error:', error);
    } finally {
      setIsBacktesting(false);
      setBacktestProgress(0);
    }
  };

  const removeAlert = (alertId: string) => {
    setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== alertId));
  };

  return (
    <div className="space-y-4">
      <div className="p-4 flex justify-between items-center">
        <div className="flex gap-4">
          <button
            onClick={runBacktest}
            disabled={isBacktesting}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white disabled:opacity-50"
          >
            <History className="w-4 h-4" />
            {isBacktesting ? `Backtesting... ${backtestProgress}%` : 'Run 24h Backtest'}
          </button>

          <button
            onClick={() => setDebugMode(!debugMode)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-white ${
              debugMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-600 hover:bg-gray-700'
            }`}
          >
            {debugMode ? 'Disable Debug Mode' : 'Enable Debug Mode'}
          </button>
        </div>

        <button
          onClick={toggleMute}
          className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white"
        >
          {isMuted ? (
            <>
              <VolumeX className="w-4 h-4" />
              <span>Unmute Alerts</span>
            </>
          ) : (
            <>
              <Volume2 className="w-4 h-4" />
              <span>Mute Alerts</span>
            </>
          )}
        </button>
      </div>

      {/* Live Alerts */}
      <div className="overflow-x-auto">
        <h3 className="text-lg font-semibold px-4 mb-2">Live Alerts</h3>
        {alerts.length === 0 ? (
          <div className="bg-gray-800/20 rounded-lg p-6 text-center">
            <p className="text-gray-400">No alerts yet</p>
          </div>
        ) : (
          <table className="w-full divide-y divide-gray-700">
            <thead className="bg-gray-800/50">
              <tr>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Asset</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">5m Change</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">24h Change</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Volume Ratio</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rel. Volume</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Spike Factor</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Alert Type</th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700 bg-gray-800/20">
              {alerts.map((alert) => (
                <tr key={alert.id} className="hover:bg-gray-800/50">
                  <td className="py-4 px-4 text-gray-300">
                    {alert.timestamp.toLocaleTimeString()}
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center gap-3">
                      {alert.image && (
                        <img 
                          src={alert.image} 
                          alt={alert.symbol} 
                          className="w-6 h-6 rounded-full"
                        />
                      )}
                      <button
                        onClick={() => onSymbolClick(alert.symbol)}
                        className="font-medium text-white hover:underline"
                      >
                        {alert.symbol.toUpperCase()}
                      </button>
                    </div>
                  </td>
                  <td className="py-4 px-4 font-medium text-white">
                    {formatCurrency(alert.price)}
                  </td>
                  <td className="py-4 px-4 font-medium text-green-500">
                    {!alert.isNewHigh && alert.priceChange && (
                      <div className="flex items-center gap-1">
                        <ArrowUp className="w-4 h-4" />
                        {formatPercentage(alert.priceChange)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 font-medium">
                    {alert.price_change_percentage_24h && (
                      <div className={`flex items-center gap-1 ${
                        alert.price_change_percentage_24h > 0 ? 'text-green-500' : 'text-red-500'
                      }`}>
                        {alert.price_change_percentage_24h > 0 ? (
                          <ArrowUp className="w-4 h-4" />
                        ) : (
                          <ArrowDown className="w-4 h-4" />
                        )}
                        {formatPercentage(alert.price_change_percentage_24h)}
                      </div>
                    )}
                  </td>
                  <td className="py-4 px-4 text-blue-400">
                    {!alert.isNewHigh && alert.volumeRatio && 
                      `${alert.volumeRatio.toFixed(2)}x`
                    }
                  </td>
                  <td className="py-4 px-4 text-blue-400">
                    {alert.relative_volume && 
                      `${alert.relative_volume.toFixed(2)}x`
                    }
                  </td>
                  <td className="py-4 px-4 text-blue-400">
                    {alert.spike_factor && 
                      `${alert.spike_factor.toFixed(2)}x`
                    }
                  </td>
                  <td className="py-4 px-4">
                    {alert.isNewHigh ? (
                      <div className="flex items-center gap-2 text-yellow-500">
                        <Sparkles className="w-4 h-4" />
                        <span>New High</span>
                      </div>
                    ) : alert.relative_volume && alert.spike_factor &&
                       alert.relative_volume >= 5 && alert.spike_factor >= 1.5 ? (
                      <div className="flex items-center gap-2 text-purple-500">
                        <TrendingUp className="w-4 h-4" />
                        <span>Volume Spike</span>
                      </div>
                    ) : (
                      <span className="text-green-500">Momentum</span>
                    )}
                  </td>
                  <td className="py-4 px-4">
                    <button
                      onClick={() => removeAlert(alert.id)}
                      className="text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Historical Alerts */}
      {historicalAlerts.length > 0 && (
        <div className="border-t border-gray-700 pt-4">
          <h3 className="text-lg font-semibold px-4 mb-2">Historical Alerts (Last 24h)</h3>
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-700">
              <thead className="bg-gray-800/50">
                <tr>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Asset</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Price</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">5m Change</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Volume Ratio</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Rel. Volume</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Spike Factor</th>
                  <th className="py-3 px-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Alert Type</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700 bg-gray-800/20">
                {historicalAlerts.map((alert, index) => (
                  <tr key={`${alert.symbol}-${alert.timestamp.getTime()}`} className="hover:bg-gray-800/50">
                    <td className="py-4 px-4 text-gray-300">
                      {alert.timestamp.toLocaleTimeString()}
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => onSymbolClick(alert.symbol)}
                        className="font-medium text-white hover:underline"
                      >
                        {alert.symbol.toUpperCase()}
                      </button>
                    </td>
                    <td className="py-4 px-4 font-medium text-white">
                      {formatCurrency(alert.price)}
                    </td>
                    <td className="py-4 px-4 font-medium text-green-500">
                      {!alert.isNewHigh && (
                        <div className="flex items-center gap-1">
                          <ArrowUp className="w-4 h-4" />
                          {formatPercentage(alert.priceChange)}
                        </div>
                      )}
                    </td>
                    <td className="py-4 px-4 text-blue-400">
                      {!alert.isNewHigh && `${alert.volumeRatio.toFixed(2)}x`}
                    </td>
                    <td className="py-4 px-4 text-blue-400">
                      {alert.relative_volume && 
                        `${alert.relative_volume.toFixed(2)}x`
                      }
                    </td>
                    <td className="py-4 px-4 text-blue-400">
                      {alert.spike_factor && 
                        `${alert.spike_factor.toFixed(2)}x`
                      }
                    </td>
                    <td className="py-4 px-4">
                      {alert.isNewHigh ? (
                        <div className="flex items-center gap-2 text-yellow-500">
                          <Sparkles className="w-4 h-4" />
                          <span>New High</span>
                        </div>
                      ) : alert.relative_volume && alert.spike_factor &&
                         alert.relative_volume >= 5 && alert.spike_factor >= 1.5 ? (
                        <div className="flex items-center gap-2 text-purple-500">
                          <TrendingUp className="w-4 h-4" />
                          <span>Volume Spike</span>
                        </div>
                      ) : (
                        <span className="text-green-500">Momentum</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default MomentumScanner;