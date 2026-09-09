/**
 * @file MoneyInput.tsx
 * @description Wiederverwendbares Eingabefeld für Geldbeträge mit Banknoten-Icon
 * und optimierter numerischer Tastatur- und Tastatureingabe. Unterstützt das direkte
 * Eintippen oder Einfügen von Beträgen mit Tausendertrennzeichen (z. B. 16.930,02 €).
 * @module components/MoneyInput
 */

import React, { useState, useEffect } from 'react';
import { Banknote } from 'lucide-react';
import { parseCurrencyValue, formatAmountForInput } from '@/utils/moneyUtils';

export interface MoneyInputProps {
  value: number;
  onChange: (val: number) => void;
  placeholder?: string;
  step?: string | number;
  min?: string | number;
  max?: string | number;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  id?: string;
}

export const MoneyInput: React.FC<MoneyInputProps> = ({
  value,
  onChange,
  placeholder = '0.00',
  step = '0.01',
  min,
  max,
  className = '',
  disabled = false,
  required = false,
  autoFocus = false,
  id,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [localText, setLocalText] = useState<string>(() => formatAmountForInput(value));

  // Synchronisieren, wenn sich der Wert von außen ändert und das Feld nicht aktiv fokussiert ist
  useEffect(() => {
    if (!isFocused) {
      setLocalText(formatAmountForInput(value));
    }
  }, [value, isFocused]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;

    if (text.trim() === '' || text === '-' || text === '+' || text === ',' || text === '.') {
      setLocalText(text);
      onChange(0);
      return;
    }

    const hasGroupersOrCurrency =
      text.includes('€') ||
      (text.includes('.') && text.includes(',')) ||
      /\b(EUR|USD|CHF)\b/i.test(text) ||
      /['’]/.test(text);

    const parsed = parseCurrencyValue(text);

    if (hasGroupersOrCurrency && !isNaN(parsed)) {
      setLocalText(formatAmountForInput(parsed));
    } else {
      setLocalText(text);
    }

    onChange(isNaN(parsed) ? 0 : parsed);
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    setLocalText(formatAmountForInput(value));
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (!pastedText) return;

    const parsed = parseCurrencyValue(pastedText);
    if (!isNaN(parsed)) {
      e.preventDefault();
      onChange(parsed);
      setLocalText(formatAmountForInput(parsed));
    }
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="pointer-events-none absolute left-2.5 flex items-center text-slate-400">
        <Banknote className="h-4 w-4" />
      </div>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        required={required}
        disabled={disabled}
        autoFocus={autoFocus}
        value={localText}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onPaste={handlePaste}
        placeholder={placeholder}
        className="h-10 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 font-mono text-sm font-semibold text-slate-900 shadow-sm transition-all [appearance:textfield] placeholder:font-normal placeholder:text-slate-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
    </div>
  );
};
