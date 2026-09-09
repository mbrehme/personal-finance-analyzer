/**
 * @file DateRangePicker.tsx
 * @description Wiederverwendbare Date- und Period-Range-Picker-Komponente für Monats-,
 * Quartals-, Halbjahres- und Jahresebene mit Schnellauswahl-Presets und benutzerdefinierter Von-Bis-Wahl.
 * @module components/DateRangePicker
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Calendar, ChevronDown, X, Check } from 'lucide-react';
import {
  DateRange,
  DateRangePreset,
  DATE_RANGE_PRESETS,
  getDateRangeForPreset,
  getMonthDateRange,
  detectPresetForRange,
  formatDateRangeDisplay,
} from '@/utils/dateUtils';

export interface DateRangePickerProps {
  /** Startdatum im Format YYYY-MM-DD oder leer */
  startDate?: string;
  /** Enddatum im Format YYYY-MM-DD oder leer */
  endDate?: string;
  /** Callback bei Auswahl eines neuen Zeitraums */
  onChange: (range: DateRange) => void;
  /** Optionale zusätzliche CSS-Klassen */
  className?: string;
  /** Platzhaltertext bei unbegrenztem Zeitraum */
  placeholder?: string;
  /** Ausrichtung des Popovers (Standard: 'right') */
  align?: 'left' | 'right';
}

/**
 * Universelle Komponente zur Auswahl von Datums- und Perioden-Bereichen.
 *
 * @param {DateRangePickerProps} props - Komponenten-Properties
 * @returns {JSX.Element} DateRangePicker Element
 *
 * @example
 * ```tsx
 * <DateRangePicker
 *   startDate={filters.startDate}
 *   endDate={filters.endDate}
 *   onChange={(range) => setFilters(prev => ({ ...prev, ...range }))}
 * />
 * ```
 */
export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  startDate = '',
  endDate = '',
  onChange,
  className = '',
  placeholder = 'Gesamter Zeitraum',
  align = 'right',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialwerte für Monats-Felder (YYYY-MM)
  const [startMonth, setStartMonth] = useState(() => (startDate ? startDate.substring(0, 7) : ''));
  const [endMonth, setEndMonth] = useState(() => (endDate ? endDate.substring(0, 7) : ''));

  // Wenn sich die Props von außen ändern (z. B. Filter-Reset), interne Monatsfelder synchronisieren
  useEffect(() => {
    setStartMonth(startDate ? startDate.substring(0, 7) : '');
    setEndMonth(endDate ? endDate.substring(0, 7) : '');
  }, [startDate, endDate]);

  const activePreset = detectPresetForRange(startDate, endDate);
  const displayLabel = formatDateRangeDisplay(startDate, endDate);
  const hasSelection = Boolean(startDate || endDate);

  // Click-Outside Schließen
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setStartMonth(startDate ? startDate.substring(0, 7) : '');
        setEndMonth(endDate ? endDate.substring(0, 7) : '');
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setStartMonth(startDate ? startDate.substring(0, 7) : '');
        setEndMonth(endDate ? endDate.substring(0, 7) : '');
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, startDate, endDate]);

  const handleSelectPreset = useCallback(
    (preset: DateRangePreset) => {
      const range = getDateRangeForPreset(preset);
      onChange(range);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleCancel = useCallback(() => {
    setStartMonth(startDate ? startDate.substring(0, 7) : '');
    setEndMonth(endDate ? endDate.substring(0, 7) : '');
    setIsOpen(false);
  }, [startDate, endDate]);

  const handleApplyCustom = useCallback(() => {
    const range = getMonthDateRange(startMonth, endMonth);
    onChange(range);
    setIsOpen(false);
  }, [startMonth, endMonth, onChange]);

  const handleClear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange({ startDate: '', endDate: '' });
      setStartMonth('');
      setEndMonth('');
    },
    [onChange]
  );

  return (
    <div ref={containerRef} className={`relative ${className || 'w-full'}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label="Zeitraum auswählen"
        className={`flex h-9 w-full select-none items-center justify-between gap-2 rounded-xl border bg-white px-3 py-1.5 text-xs font-medium shadow-sm transition-all ${
          isOpen
            ? 'border-blue-500 text-slate-900 ring-2 ring-blue-500/20'
            : hasSelection
              ? 'border-blue-200 bg-blue-50/40 text-blue-900 hover:bg-blue-50/70'
              : 'border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar
            className={`h-4 w-4 shrink-0 ${hasSelection ? 'text-blue-600' : 'text-slate-400'}`}
          />
          <span className="truncate">{hasSelection ? displayLabel : placeholder}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {hasSelection && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleClear(e as any);
                }
              }}
              title="Zeitraum zurücksetzen"
              className="rounded-full p-0.5 text-slate-400 transition-colors hover:bg-slate-200/80 hover:text-slate-600"
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
          <ChevronDown
            className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-200 ${
              isOpen ? 'rotate-180 text-slate-600' : ''
            }`}
          />
        </div>
      </button>

      {/* Popover Dropdown Panel */}
      {isOpen && (
        <div
          className={`absolute top-full ${
            align === 'left' ? 'left-0' : 'right-0'
          } animate-in fade-in-50 zoom-in-95 z-50 mt-2 min-w-[340px] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl duration-150 sm:min-w-[380px]`}
        >
          {/* Header */}
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Zeitraum wählen
            </span>
            {hasSelection && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs font-semibold text-rose-600 transition-colors hover:text-rose-700"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          {/* Quick Preset Pills */}
          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Aktuell
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DATE_RANGE_PRESETS.filter((p) => p.group === 'current').map((preset) => {
                  const isSelected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 font-semibold text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Vergangen
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DATE_RANGE_PRESETS.filter((p) => p.group === 'past').map((preset) => {
                  const isSelected = activePreset === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPreset(preset.id)}
                      className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition-all ${
                        isSelected
                          ? 'bg-blue-600 font-semibold text-white shadow-sm'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
                      }`}
                    >
                      <span>{preset.label}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Benutzerdefinierter Von-Bis Bereich (Monatsebene) */}
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Benutzerdefiniert (Monate)
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                  Von Monat
                </label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCustom();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <span className="pt-4 text-xs font-bold text-slate-400">–</span>
              <div className="flex-1">
                <label className="mb-0.5 block text-[10px] font-medium text-slate-500">
                  Bis Monat
                </label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyCustom();
                    }
                  }}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="mt-3 flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
              >
                Übernehmen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
