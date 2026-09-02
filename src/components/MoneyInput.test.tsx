/**
 * @file MoneyInput.test.tsx
 * @description Unit-Tests für MoneyInput.
 * @module components/MoneyInput.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MoneyInput } from './MoneyInput';

describe('MoneyInput', () => {
  it('renders input with Banknote icon and placeholder', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={150.5} onChange={handleChange} placeholder="Betrag eingeben" />);

    expect(screen.getByPlaceholderText('Betrag eingeben')).toBeInTheDocument();
    expect(screen.getByDisplayValue('150.5')).toBeInTheDocument();
  });

  it('triggers onChange when value is typed', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} placeholder="Betrag" />);

    const input = screen.getByPlaceholderText('Betrag');
    fireEvent.change(input, { target: { value: '250' } });

    expect(handleChange).toHaveBeenCalledWith(250);
  });
});

