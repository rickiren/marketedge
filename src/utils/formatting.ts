/**
 * Format a number as currency
 */
export const formatCurrency = (value: number): string => {
  if (value >= 1) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);
  } else {
    // For values less than 1, show more decimal places
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(value);
  }
};

/**
 * Format a percentage value with a + sign for positive values
 */
export const formatPercentage = (value: number | undefined | null): string => {
  if (value === undefined || value === null) {
    return '0.00%';
  }
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(2)}%`;
};

/**
 * Format large numbers with k, M, B, T suffixes
 */
export const formatLargeNumber = (value: number): string => {
  if (value >= 1e12) {
    return `${(value / 1e12).toFixed(2)}T`;
  } else if (value >= 1e9) {
    return `${(value / 1e9).toFixed(2)}B`;
  } else if (value >= 1e6) {
    return `${(value / 1e6).toFixed(2)}M`;
  } else if (value >= 1e3) {
    return `${(value / 1e3).toFixed(2)}K`;
  }
  return value.toFixed(2);
};

/**
 * Determines the CSS class for percentage change
 */
export const getPercentageClass = (value: number): string => {
  if (value > 0) {
    return 'text-green-500';
  } else if (value < 0) {
    return 'text-red-500';
  }
  return 'text-gray-400';
};

/**
 * Determines the CSS class for price change
 */
export const getPriceChangeClass = (current: number, previous?: number): string => {
  if (!previous) return '';
  if (current > previous) {
    return 'text-green-500 transition-colors duration-500';
  } else if (current < previous) {
    return 'text-red-500 transition-colors duration-500';
  }
  return '';
};

/**
 * Calculate Simple Moving Average (SMA)
 */
export const calculateSMA = (data: number[], period: number): number => {
  if (data.length < period) return 0;
  const sum = data.slice(0, period).reduce((acc, val) => acc + val, 0);
  return sum / period;
};

/**
 * Calculate relative volume and spike factor
 */
export const calculateVolumeMetrics = (
  currentVolume: number,
  previousVolume: number,
  historicalVolumes: number[]
): { relativeVolume: number; spikeFactor: number } => {
  // Calculate SMA 12 for volume
  const sma12 = calculateSMA(historicalVolumes, 12);
  
  // Calculate relative volume (current volume compared to SMA 12)
  const relativeVolume = sma12 > 0 ? currentVolume / sma12 : 1;
  
  // Calculate spike factor (current volume compared to previous volume)
  const spikeFactor = previousVolume > 0 ? currentVolume / previousVolume : 1;
  
  return { relativeVolume, spikeFactor };
};