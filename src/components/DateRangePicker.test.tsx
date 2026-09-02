/**
 * @file DateRangePicker.test.tsx
 * @description Unit-Tests für die DateRangePicker-Komponente.
 * @module components/DateRangePicker.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DateRangePicker } from './DateRangePicker';

describe('DateRangePicker', () => {
  it('renders trigger button with placeholder when no date is selected', () => {
    render(<DateRangePicker onChange={vi.fn()} />);

    expect(screen.getByRole('button', { name: /Zeitraum auswählen/i })).toBeInTheDocument();
    expect(screen.getByText('Gesamter Zeitraum')).toBeInTheDocument();
  });

  it('renders formatted label when dates are active', () => {
    render(
      <DateRangePicker
        startDate="2026-01-01"
        endDate="2026-12-31"
        onChange={vi.fn()}
      />
    );

    expect(screen.getByText('Dieses Jahr (2026)')).toBeInTheDocument();
  });

  it('opens popover panel on click and allows selecting a preset', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<DateRangePicker onChange={handleChange} />);

    const trigger = screen.getByRole('button', { name: /Zeitraum auswählen/i });
    await user.click(trigger);

    // Popover sollte sichtbar sein
    expect(screen.getByText('Zeitraum wählen')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dieses Jahr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dieses Halbjahr' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dieses Quartal' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dieser Monat' })).toBeInTheDocument();

    // Klick auf "Dieses Jahr"
    await user.click(screen.getByRole('button', { name: 'Dieses Jahr' }));

    expect(handleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      })
    );

    // Popover sollte nach Preset-Klick geschlossen sein
    expect(screen.queryByText('Zeitraum wählen')).not.toBeInTheDocument();
  });

  it('handles custom month selection and apply button', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<DateRangePicker onChange={handleChange} />);

    await user.click(screen.getByRole('button', { name: /Zeitraum auswählen/i }));

    const inputs = screen.getAllByDisplayValue('');
    const startInput = inputs[0]; // Von Monat
    const endInput = inputs[1];   // Bis Monat

    fireEvent.change(startInput, { target: { value: '2025-03' } });
    fireEvent.change(endInput, { target: { value: '2025-06' } });

    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2025-03-01',
      endDate: '2025-06-30',
    });
  });

  it('clears selection when clicking the clear icon', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(
      <DateRangePicker
        startDate="2026-01-01"
        endDate="2026-12-31"
        onChange={handleChange}
      />
    );

    const clearBtn = screen.getByTitle('Zeitraum zurücksetzen');
    await user.click(clearBtn);

    expect(handleChange).toHaveBeenCalledWith({
      startDate: '',
      endDate: '',
    });
  });

  it('closes popover on Escape key', async () => {
    const user = userEvent.setup();

    render(<DateRangePicker onChange={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /Zeitraum auswählen/i }));
    expect(screen.getByText('Zeitraum wählen')).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Zeitraum wählen')).not.toBeInTheDocument();
  });
});

