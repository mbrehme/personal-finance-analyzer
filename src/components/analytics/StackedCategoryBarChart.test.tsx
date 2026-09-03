/**
 * @file StackedCategoryBarChart.test.tsx
 * @description Unit-Tests für die StackedCategoryBarChart Komponente.
 * @module components/analytics/StackedCategoryBarChart.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StackedCategoryBarChart } from './StackedCategoryBarChart';
import { CashflowAnalysisResult } from '@/services/analytics/cashflowCalculator';

const mockResult: CashflowAnalysisResult = {
  periodKeys: ['2026-01', '2026-02'],
  rows: [
    {
      category: {
        id: 'cat-income',
        name: 'Gehalt',
        parentId: null,
        color: '#10b981',
        icon: 'Wallet',
      },
      bucket: {
        id: 'cat-income',
        name: 'Gehalt',
        parentId: null,
        color: '#10b981',
        icon: 'Wallet',
      },
      depth: 0,
      hasChildren: false,
      periods: {
        '2026-01': { inbound: 3000, outbound: 0, net: 3000 },
        '2026-02': { inbound: 3200, outbound: 0, net: 3200 },
      },
      totalInbound: 6200,
      totalOutbound: 0,
      totalNet: 6200,
    },
    {
      category: {
        id: 'cat-food',
        name: 'Lebensmittel',
        parentId: null,
        color: '#f59e0b',
        icon: 'Utensils',
      },
      bucket: {
        id: 'cat-food',
        name: 'Lebensmittel',
        parentId: null,
        color: '#f59e0b',
        icon: 'Utensils',
      },
      depth: 0,
      hasChildren: false,
      periods: {
        '2026-01': { inbound: 0, outbound: -400, net: -400 },
        '2026-02': { inbound: 0, outbound: -500, net: -500 },
      },
      totalInbound: 0,
      totalOutbound: -900,
      totalNet: -900,
    },
  ],
  uncategorizedRow: {
    periods: {
      '2026-01': { inbound: 0, outbound: -50, net: -50 },
      '2026-02': { inbound: 0, outbound: 0, net: 0 },
    },
    totalInbound: 0,
    totalOutbound: -50,
    totalNet: -50,
  },
  totalRow: {
    periods: {
      '2026-01': { inbound: 3000, outbound: -450, net: 2550 },
      '2026-02': { inbound: 3200, outbound: -500, net: 2700 },
    },
    totalInbound: 6200,
    totalOutbound: -950,
    totalNet: 5250,
  },
};

const emptyResult: CashflowAnalysisResult = {
  periodKeys: ['2026-01'],
  rows: [],
  uncategorizedRow: {
    periods: { '2026-01': { inbound: 0, outbound: 0, net: 0 } },
    totalInbound: 0,
    totalOutbound: 0,
    totalNet: 0,
  },
  totalRow: {
    periods: { '2026-01': { inbound: 0, outbound: 0, net: 0 } },
    totalInbound: 0,
    totalOutbound: 0,
    totalNet: 0,
  },
};

describe('StackedCategoryBarChart', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders chart title, bar chart and donut pie chart', () => {
    render(<StackedCategoryBarChart result={mockResult} granularity="monthly" />);

    expect(screen.getByText('Cashflow & Ø Ausgaben nach Kategorien')).toBeInTheDocument();
    expect(screen.getByTestId('chart-svg')).toBeInTheDocument();
    expect(screen.getByTestId('donut-chart-svg')).toBeInTheDocument();
    expect(screen.getByTestId('donut-legend')).toBeInTheDocument();

    const rects = document.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThanOrEqual(4);
  });

  it('renders empty state when there are no transactions', () => {
    render(<StackedCategoryBarChart result={emptyResult} granularity="monthly" />);

    expect(
      screen.getByText('Keine Buchungen im ausgewählten Zeitraum vorhanden.')
    ).toBeInTheDocument();
  });

  it('toggles collapse state with chevron button', async () => {
    const user = userEvent.setup();
    render(<StackedCategoryBarChart result={mockResult} granularity="monthly" />);

    const collapseBtn = screen.getByLabelText('Diagramme ausblenden');
    await user.click(collapseBtn);

    expect(screen.queryByTestId('chart-svg')).not.toBeInTheDocument();
    expect(screen.queryByTestId('donut-chart-svg')).not.toBeInTheDocument();

    const expandBtn = screen.getByLabelText('Diagramme einblenden');
    await user.click(expandBtn);
    expect(screen.getByTestId('chart-svg')).toBeInTheDocument();
    expect(screen.getByTestId('donut-chart-svg')).toBeInTheDocument();
  });

  it('displays tooltip on hover over a bar slice', async () => {
    render(<StackedCategoryBarChart result={mockResult} granularity="monthly" />);

    const rects = document.querySelectorAll('rect');
    expect(rects.length).toBeGreaterThan(0);

    fireEvent.mouseEnter(rects[0]);

    const tooltip = await screen.findByTestId('chart-slice-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(screen.getByText('Betrag:')).toBeInTheDocument();
  });

  it('displays tooltip on hover over a donut slice', async () => {
    render(<StackedCategoryBarChart result={mockResult} granularity="monthly" />);

    const donutPaths = screen.getByTestId('donut-chart-svg').querySelectorAll('path');
    expect(donutPaths.length).toBeGreaterThan(0);

    fireEvent.mouseEnter(donutPaths[0]);

    const tooltip = await screen.findByTestId('donut-slice-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(screen.getByText(/Ø pro Monat:/i)).toBeInTheDocument();
  });
});
