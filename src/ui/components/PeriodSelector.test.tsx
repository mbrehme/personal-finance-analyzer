/**
 * @file PeriodSelector.test.tsx
 * @description Unit-Tests für PeriodSelector.
 * @module components/PeriodSelector.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PeriodSelector } from './PeriodSelector';

describe('PeriodSelector', () => {
  it('renders all 4 granularity buttons and highlights active selection', () => {
    const handleChange = vi.fn();
    render(<PeriodSelector value="monthly" onChange={handleChange} />);

    expect(screen.getByText('Monatlich')).toBeInTheDocument();
    expect(screen.getByText('Quartal')).toBeInTheDocument();
    expect(screen.getByText('Halbjahr')).toBeInTheDocument();
    expect(screen.getByText('Jährlich')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Quartal'));
    expect(handleChange).toHaveBeenCalledWith('quarterly');
  });
});
