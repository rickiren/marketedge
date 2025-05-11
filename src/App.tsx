import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import { TrendingUp, Activity } from 'lucide-react';
import CryptoPage from './pages/CryptoPage';
import PolygonPage from './pages/PolygonPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
        <nav className="bg-gray-800 border-b border-gray-700">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-8">
                <Link
                  to="/"
                  className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
                >
                  <TrendingUp className="w-6 h-6" />
                  <span className="font-semibold">Crypto Tracker</span>
                </Link>
                <Link
                  to="/polygon"
                  className="flex items-center gap-2 text-white hover:text-blue-400 transition-colors"
                >
                  <Activity className="w-6 h-6" />
                  <span className="font-semibold">Polygon Stream</span>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<CryptoPage />} />
          <Route path="/polygon" element={<PolygonPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;