import React from 'react';
import { X } from 'lucide-react';

interface Source {
  title: string;
  url: string;
}

interface GrokAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  coin: string;
  change: number;
}

const GrokAnalysisModal: React.FC<GrokAnalysisModalProps> = ({ isOpen, onClose, coin, change }) => {
  const [analysis, setAnalysis] = React.useState<string>('');
  const [sources, setSources] = React.useState<Source[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      analyzeCoin();
    } else {
      setError(null);
    }
  }, [isOpen, coin, change]);

  const analyzeCoin = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('https://api.x.ai/grok/analyze', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_GROK_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: `Analyze possible catalysts for the price pump of ${coin} (${change > 0 ? '+' : ''}${change.toFixed(2)}%) on ${new Date().toLocaleDateString()}, using web and X data. Provide sources if available.`
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setAnalysis(data.analysis);
      setSources(data.sources);
    } catch (error) {
      console.error('Analysis error:', error);
      setError('Failed to fetch analysis. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Price Analysis: {coin.toUpperCase()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="text-red-400 bg-red-900/20 p-4 rounded-lg">
              {error}
            </div>
          ) : (
            <div className="prose prose-invert max-w-none">
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-2">Analysis</h3>
                <p className="text-gray-300 whitespace-pre-wrap">{analysis}</p>
              </div>
              
              {sources && sources.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Sources</h3>
                  <ul className="list-disc pl-5 space-y-2">
                    {sources.map((source, index) => (
                      <li key={index}>
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                        >
                          {source.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GrokAnalysisModal;