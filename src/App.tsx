/**
 * @file App.tsx
 * @description Hauptkomponente der Anwendung mit Routen-Setup und FinanceProvider State Context.
 * @module App
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider } from '@/services/storage/FinanceContext';
import { Header } from '@/components/Header';
import { Home } from '@/pages/Home';
import { Configuration } from '@/pages/Configuration';
import { Transactions } from '@/pages/Transactions';
import { Cashflow } from '@/pages/Cashflow';
import { Balances } from '@/pages/Balances';

export const App: React.FC = () => {
  return (
    <FinanceProvider>
      <Router>
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 sm:px-6 lg:px-8 py-6">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/configuration" element={<Configuration />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/cashflow" element={<Cashflow />} />
              <Route path="/balances" element={<Balances />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <footer className="border-t border-slate-200 bg-white py-6">
            <div className="mx-auto max-w-7xl px-4 text-center text-xs text-slate-500 sm:px-6 lg:px-8">
              Personal Finance Analyzer &bull; 100% Client-Side & Local-First &bull;{' '}
              {new Date().getFullYear()}
            </div>
          </footer>
        </div>
      </Router>
    </FinanceProvider>
  );
};

export default App;
