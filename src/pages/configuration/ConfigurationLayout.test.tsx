/**
 * @file ConfigurationLayout.test.tsx
 * @description Unit-Tests für den ConfigurationLayout Container.
 * @module pages/configuration/ConfigurationLayout.test
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { ConfigurationLayout } from './ConfigurationLayout';
import { FinanceProvider } from '@/services/storage/FinanceContext';

describe('ConfigurationLayout', () => {
  it('renders header, export/import buttons and subpage tabs', async () => {
    render(
      <MemoryRouter
        initialEntries={['/configuration/categories']}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <FinanceProvider>
          <Routes>
            <Route path="/configuration" element={<ConfigurationLayout />}>
              <Route path="categories" element={<div>Categories Content</div>} />
              <Route path="accounts" element={<div>Accounts Content</div>} />
            </Route>
          </Routes>
        </FinanceProvider>
      </MemoryRouter>
    );

    expect(await screen.findByText('Konfiguration')).toBeInTheDocument();
    expect(screen.getByText('JSON Export')).toBeInTheDocument();
    expect(screen.getByText('JSON Import')).toBeInTheDocument();
    expect(screen.getByText('Zurücksetzen')).toBeInTheDocument();
    expect(screen.getByText(/Kategorien \(\d+\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Konten \(\d+\)/i)).toBeInTheDocument();
    expect(screen.getByText('Categories Content')).toBeInTheDocument();
  });
});
