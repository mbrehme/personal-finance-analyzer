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
    expect(screen.getByDisplayValue('150,50')).toBeInTheDocument();
  });

  it('triggers onChange when value is typed', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} placeholder="Betrag" />);

    const input = screen.getByPlaceholderText('Betrag');
    fireEvent.change(input, { target: { value: '250' } });

    expect(handleChange).toHaveBeenCalledWith(250);
  });

  it('correctly handles typing 16.930,02 with thousand separators and cents', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} placeholder="0,00" />);

    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '16.930,02' } });

    expect(handleChange).toHaveBeenCalledWith(16930.02);
    expect(screen.getByDisplayValue('16.930,02')).toBeInTheDocument();
  });

  it('correctly handles pasting 16.930,02 and formats display as 16.930,02', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} placeholder="0,00" />);

    const input = screen.getByPlaceholderText('0,00');
    fireEvent.paste(input, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? '16.930,02' : ''),
      },
    });

    expect(handleChange).toHaveBeenCalledWith(16930.02);
    expect(screen.getByDisplayValue('16.930,02')).toBeInTheDocument();
  });

  it('handles pasting formatted currency string with euro symbol (e.g. 16.930,02 €)', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} placeholder="0,00" />);

    const input = screen.getByPlaceholderText('0,00');
    fireEvent.paste(input, {
      clipboardData: {
        getData: (format: string) => (format === 'text' ? '16.930,02 €' : ''),
      },
    });

    expect(handleChange).toHaveBeenCalledWith(16930.02);
    expect(screen.getByDisplayValue('16.930,02')).toBeInTheDocument();
  });

  it('supports decimal comma input (e.g. 150,5 and 0,02)', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={0} onChange={handleChange} placeholder="0,00" />);

    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '150,5' } });
    expect(handleChange).toHaveBeenCalledWith(150.5);

    fireEvent.change(input, { target: { value: '0,02' } });
    expect(handleChange).toHaveBeenCalledWith(0.02);
  });

  it('resets to 0 when input is cleared', () => {
    const handleChange = vi.fn();
    render(<MoneyInput value={150} onChange={handleChange} placeholder="0,00" />);

    const input = screen.getByPlaceholderText('0,00');
    fireEvent.change(input, { target: { value: '' } });

    expect(handleChange).toHaveBeenCalledWith(0);
  });
});
