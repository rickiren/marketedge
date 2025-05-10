import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { NewsArticle } from '../types';
import { formatDistanceToNow } from 'date-fns';

interface NewsSnippetModalProps {
  isOpen: boolean;
  onClose: () => void;
  articles: NewsArticle[];
  symbol: string;
}

const NewsSnippetModal: React.FC<NewsSnippetModalProps> = ({ isOpen, onClose, articles, symbol }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-white">Latest News: {symbol.toUpperCase()}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {articles.length === 0 ? (
            <p className="text-gray-400">No recent news articles found.</p>
          ) : (
            <div className="space-y-6">
              {articles.map((article) => (
                <article key={article.id} className="border-b border-gray-700 pb-6 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="text-lg font-semibold text-white">{article.title}</h3>
                    <span className="text-sm text-gray-400 whitespace-nowrap ml-4">
                      {formatDistanceToNow(article.published_at * 1000, { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-gray-300 mb-3">{article.body}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-400">Source: {article.source}</span>
                    <a
                      href={article.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors text-sm"
                    >
                      Read more <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NewsSnippetModal;