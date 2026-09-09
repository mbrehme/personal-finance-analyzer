/**
 * @file AnalyticsLayout.test.tsx
 * @description Unit-Tests für AnalyticsLayout.
 * @module pages/analytics/AnalyticsLayout.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { FinanceProvider } from '@/domain';
import { AnalyticsLayout, ANALYTICS_GRANULARITY_KEY } from './AnalyticsLayout';
import { useAnalyticsFilter } from './AnalyticsContext';

const DummyChild = () => {
  const filter = useAnalyticsFilter();
  return (
    <div>
      <span data-testid="current-granularity">{filter.granularity}</span>
      <span data-testid="current-account">{filter.selectedAccountId ?? 'all'}</span>
    </div>
  );
};

describe('AnalyticsLayout', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders global header, tabs and outlet with default filters', () => {
    render(
      <FinanceProvider>
        <MemoryRouter
          initialEntries={['/analytics/cashflow']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/analytics" element={<AnalyticsLayout />}>
              <Route path="cashflow" element={<DummyChild />} />
              <Route path="balances" element={<div>Balances Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </FinanceProvider>
    );

    expect(screen.getByRole('heading', { name: /Analyse/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cashflow/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Salden/i })).toBeInTheDocument();
    expect(screen.getByTestId('current-granularity')).toHaveTextContent('monthly');
  });

  it('allows changing granularity and persists in localStorage', async () => {
    const user = userEvent.setup();

    render(
      <FinanceProvider>
        <MemoryRouter
          initialEntries={['/analytics/cashflow']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/analytics" element={<AnalyticsLayout />}>
              <Route path="cashflow" element={<DummyChild />} />
            </Route>
          </Routes>
        </MemoryRouter>
      </FinanceProvider>
    );

    const quarterlyBtn = screen.getByRole('button', { name: 'Quartal' });
    await user.click(quarterlyBtn);

    expect(screen.getByTestId('current-granularity')).toHaveTextContent('quarterly');
    expect(localStorage.getItem(ANALYTICS_GRANULARITY_KEY)).toBe('quarterly');
  });

  it('persists last visited subpage in localStorage', () => {
    render(
      <FinanceProvider>
        <MemoryRouter
          initialEntries={['/analytics/balances']}
          future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
        >
          <Routes>
            <Route path="/analytics" element={<AnalyticsLayout />}>
              <Route path="cashflow" element={<DummyChild />} />
              <Route path="balances" element={<div>Balances Content</div>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </FinanceProvider>
    );

    expect(localStorage.getItem('analytics_last_subpage')).toBe('balances');
  });
});
