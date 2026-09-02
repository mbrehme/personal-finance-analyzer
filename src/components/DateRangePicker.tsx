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
  const [startMonth, setStartMonth] = useState(() =>
    startDate ? startDate.substring(0, 7) : ''
  );
  const [endMonth, setEndMonth] = useState(() =>
    endDate ? endDate.substring(0, 7) : ''
  );

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
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectPreset = useCallback(
    (preset: DateRangePreset) => {
      const range = getDateRangeForPreset(preset);
      onChange(range);
      setIsOpen(false);
    },
    [onChange]
  );

  const handleApplyCustom = useCallback(() => {
    if (!startMonth && !endMonth) {
      onChange({ startDate: '', endDate: '' });
    } else {
      const range = getMonthDateRange(
        startMonth || endMonth,
        endMonth || startMonth
      );
      onChange(range);
    }
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
        className={`w-full h-9 px-3 py-1.5 text-xs font-medium border rounded-xl bg-white shadow-sm flex items-center justify-between gap-2 transition-all select-none ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20 text-slate-900'
            : hasSelection
            ? 'border-blue-200 bg-blue-50/40 text-blue-900 hover:bg-blue-50/70'
            : 'border-slate-300 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar
            className={`w-4 h-4 shrink-0 ${
              hasSelection ? 'text-blue-600' : 'text-slate-400'
            }`}
          />
          <span className="truncate">
            {hasSelection ? displayLabel : placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
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
              className="p-0.5 rounded-full hover:bg-slate-200/80 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
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
          } mt-2 z-50 bg-white rounded-2xl shadow-xl border border-slate-200 p-4 min-w-[340px] sm:min-w-[380px] animate-in fade-in-50 zoom-in-95 duration-150`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Zeitraum wählen
            </span>
            {hasSelection && (
              <button
                type="button"
                onClick={handleClear}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold transition-colors"
              >
                Zurücksetzen
              </button>
            )}
          </div>

          {/* Quick Preset Pills */}
          <div className="space-y-3">
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Aktuell
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DATE_RANGE_PRESETS.filter((p) => p.group === 'current').map(
                  (preset) => {
                    const isSelected = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Vergangen
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {DATE_RANGE_PRESETS.filter((p) => p.group === 'past').map(
                  (preset) => {
                    const isSelected = activePreset === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleSelectPreset(preset.id)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all text-left flex items-center justify-between ${
                          isSelected
                            ? 'bg-blue-600 text-white font-semibold shadow-sm'
                            : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                        }`}
                      >
                        <span>{preset.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  }
                )}
              </div>
            </div>
          </div>

          {/* Benutzerdefinierter Von-Bis Bereich (Monatsebene) */}
          <div className="border-t border-slate-100 pt-3 mt-3">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Benutzerdefiniert (Monate)
            </div>
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">
                  Von Monat
                </label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
              <span className="text-slate-400 text-xs font-bold pt-4">–</span>
              <div className="flex-1">
                <label className="block text-[10px] text-slate-500 mb-0.5 font-medium">
                  Bis Monat
                </label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-sm transition-colors"
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

