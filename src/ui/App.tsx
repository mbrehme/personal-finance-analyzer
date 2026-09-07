/**
 * @file App.tsx
 * @description Hauptkomponente der Anwendung mit Routen-Setup und FinanceProvider State Context.
 * @module App
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { FinanceProvider } from '@/domain';
import { Header } from '@/ui/components/Header';
import { Home } from '@/ui/pages/Home';
import { ConfigurationLayout, CategoriesConfig, AccountsConfig } from '@/ui/pages/configuration';
import { AnalyticsLayout } from '@/ui/pages/analytics';
import { Transactions } from '@/ui/pages/Transactions';
import { Cashflow } from '@/ui/pages/Cashflow';
import { Balances } from '@/ui/pages/Balances';

export const App: React.FC = () => {
  return (
    <FinanceProvider>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
          <Header />
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/configuration" element={<ConfigurationLayout />}>
                <Route index element={<Navigate to="categories" replace />} />
                <Route path="categories" element={<CategoriesConfig />} />
                <Route
                  path="buckets"
                  element={<Navigate to="/configuration/categories" replace />}
                />
                <Route path="accounts" element={<AccountsConfig />} />
              </Route>
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/cashflow" element={<Cashflow />} />
              <Route path="/balances" element={<Balances />} />
              <Route path="/analytics" element={<AnalyticsLayout />}>
                <Route index element={<Navigate to="cashflow" replace />} />
                <Route path="cashflow" element={<Cashflow />} />
                <Route path="balances" element={<Balances />} />
              </Route>
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
