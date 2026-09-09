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
    render(<DateRangePicker startDate="2026-01-01" endDate="2026-12-31" onChange={vi.fn()} />);

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
    const endInput = inputs[1]; // Bis Monat

    fireEvent.change(startInput, { target: { value: '2025-03' } });
    fireEvent.change(endInput, { target: { value: '2025-06' } });

    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));

    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2025-03-01',
      endDate: '2025-06-30',
    });
  });

  it('does not set von month when only bis month is entered, and vice versa, applying only after clicking Übernehmen', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    const { rerender } = render(<DateRangePicker onChange={handleChange} />);

    await user.click(screen.getByRole('button', { name: /Zeitraum auswählen/i }));

    const inputs = screen.getAllByDisplayValue('');
    const startInput = inputs[0] as HTMLInputElement;
    const endInput = inputs[1] as HTMLInputElement;
    expect(startInput.value).toBe('');

    // 1. Enter ONLY Bis Monat (e.g. 2025-10) -> does NOT call handleChange yet
    fireEvent.change(endInput, { target: { value: '2025-10' } });
    expect(startInput.value).toBe('');
    expect(handleChange).not.toHaveBeenCalled();

    // Click Übernehmen -> now handleChange is called
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '',
      endDate: '2025-10-31',
    });

    // Simulate parent re-rendering with new endDate and opening popover again
    rerender(<DateRangePicker startDate="" endDate="2025-10-31" onChange={handleChange} />);
    await user.click(screen.getByRole('button', { name: /Zeitraum auswählen/i }));

    const updatedInputs = screen.getAllByDisplayValue(/2025-10|^$/);
    const updatedStart = updatedInputs.find(
      (i) => (i as HTMLInputElement).value === ''
    ) as HTMLInputElement;
    const updatedEnd = updatedInputs.find(
      (i) => (i as HTMLInputElement).value === '2025-10'
    ) as HTMLInputElement;

    // Von Monat must remain empty and NOT automatically set to 2025-10
    expect(updatedStart.value).toBe('');
    expect(updatedEnd.value).toBe('2025-10');

    // 2. Enter ONLY Von Monat (e.g. 2025-04)
    fireEvent.change(updatedEnd, { target: { value: '' } });
    fireEvent.change(updatedStart, { target: { value: '2025-04' } });
    expect(handleChange).toHaveBeenCalledTimes(1); // not called again yet

    // Click Übernehmen
    await user.click(screen.getByRole('button', { name: 'Übernehmen' }));
    expect(handleChange).toHaveBeenCalledWith({
      startDate: '2025-04-01',
      endDate: '',
    });

    // Simulate parent re-rendering with new startDate and opening popover
    rerender(<DateRangePicker startDate="2025-04-01" endDate="" onChange={handleChange} />);
    await user.click(screen.getByRole('button', { name: /Zeitraum auswählen/i }));

    const finalInputs = screen.getAllByDisplayValue(/2025-04|^$/);
    const finalStart = finalInputs.find(
      (i) => (i as HTMLInputElement).value === '2025-04'
    ) as HTMLInputElement;
    const finalEnd = finalInputs.find(
      (i) => (i as HTMLInputElement).value === ''
    ) as HTMLInputElement;

    // Bis Monat must remain empty and NOT automatically set to 2025-04
    expect(finalStart.value).toBe('2025-04');
    expect(finalEnd.value).toBe('');
  });

  it('clears selection when clicking the clear icon', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    render(<DateRangePicker startDate="2026-01-01" endDate="2026-12-31" onChange={handleChange} />);

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
