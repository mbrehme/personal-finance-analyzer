/**
 * @file EntityVisualFields.tsx
 * @description Wiederverwendbare Formularfelder für EntityVisualMetadata (Farbe, Icon, Name/Titel und Beschreibung).
 * Enthält interaktive Picker für Farbe (Palette + Custom Color) und Lucide-Icons (Suchfilter + Grid).
 * @module components/EntityVisualFields
 */

import React, { useState, useRef, useEffect } from 'react';
import { AVAILABLE_ICONS, IconRenderer } from '@/components/IconRenderer';
import { Search, ChevronDown, Check, Pipette } from 'lucide-react';

export interface EntityVisualFieldsProps {
  name: string;
  setName: (val: string) => void;
  color: string;
  setColor: (val: string) => void;
  icon: string;
  setIcon: (val: string) => void;
  description?: string;
  setDescription?: (val: string) => void;
  nameLabel?: string;
  namePlaceholder?: string;
}

export const PRESET_COLORS = [
  '#3b82f6', // Blue
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#a855f7', // Purple
  '#ec4899', // Pink
  '#f43f5e', // Rose
  '#ef4444', // Red
  '#f97316', // Orange
  '#f59e0b', // Amber
  '#eab308', // Yellow
  '#84cc16', // Lime
  '#10b981', // Emerald
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#0ea5e9', // Sky
  '#64748b', // Slate
];

export const EntityVisualFields: React.FC<EntityVisualFieldsProps> = ({
  name,
  setName,
  color,
  setColor,
  icon,
  setIcon,
  description = '',
  setDescription,
  nameLabel = 'Titel / Name *',
  namePlaceholder = 'z. B. Miete, Lebensmittel, Girokonto',
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  const [iconSearch, setIconSearch] = useState('');

  const colorRef = useRef<HTMLDivElement>(null);
  const iconRef = useRef<HTMLDivElement>(null);

  // Close popovers on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
      if (iconRef.current && !iconRef.current.contains(e.target as Node)) {
        setIsIconPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredIcons = AVAILABLE_ICONS.filter((ic) =>
    ic.toLowerCase().includes(iconSearch.toLowerCase().trim())
  );

  return (
    <div className="space-y-3">
      {/* Obere Zeile: Color Picker + Icon Picker + Name/Titel */}
      <div className="flex items-end gap-3">
        {/* Color Picker */}
        <div className="relative" ref={colorRef}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Farbe
          </label>
          <button
            type="button"
            onClick={() => {
              setIsColorPickerOpen(!isColorPickerOpen);
              setIsIconPickerOpen(false);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 shadow-sm transition-all hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Farbe wählen"
          >
            <span
              className="flex h-5 w-5 items-center justify-center rounded-full border border-black/10 text-white shadow-inner"
              style={{ backgroundColor: color || '#3b82f6' }}
            />
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {isColorPickerOpen && (
            <div className="animate-in fade-in-50 zoom-in-95 absolute left-0 top-full z-50 mt-2 w-64 space-y-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl duration-100">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Farbpalette
              </div>
              <div className="grid grid-cols-4 gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setColor(c);
                      setIsColorPickerOpen(false);
                    }}
                    style={{ backgroundColor: c }}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm transition-transform hover:scale-110 active:scale-95"
                    title={c}
                  >
                    {color.toLowerCase() === c.toLowerCase() && (
                      <Check className="h-5 w-5 stroke-[3]" />
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="flex items-center gap-2 border-t border-slate-100 pt-2">
                <label className="flex cursor-pointer items-center gap-1.5 text-xs font-medium text-slate-600">
                  <Pipette className="h-4 w-4 text-slate-500" />
                  Eigene Farbe:
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent"
                  />
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#000000"
                  className="w-20 rounded-lg border border-slate-300 px-2 py-1 font-mono text-xs uppercase text-slate-700"
                />
              </div>
            </div>
          )}
        </div>

        {/* Icon Picker */}
        <div className="relative" ref={iconRef}>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Icon
          </label>
          <button
            type="button"
            onClick={() => {
              setIsIconPickerOpen(!isIconPickerOpen);
              setIsColorPickerOpen(false);
            }}
            className="flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-2.5 shadow-sm transition-all hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Icon wählen"
          >
            <div
              className="flex h-6 w-6 items-center justify-center rounded-lg text-white shadow-sm"
              style={{ backgroundColor: color || '#3b82f6' }}
            >
              <IconRenderer name={icon || 'Folder'} className="h-4 w-4" />
            </div>
            <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
          </button>

          {isIconPickerOpen && (
            <div className="animate-in fade-in-50 zoom-in-95 absolute left-0 top-full z-50 mt-2 w-72 space-y-2.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl duration-100">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Icon suchen..."
                  className="w-full rounded-lg border border-slate-300 py-1.5 pl-8 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid max-h-48 grid-cols-5 gap-1.5 overflow-y-auto p-1">
                {filteredIcons.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => {
                      setIcon(ic);
                      setIsIconPickerOpen(false);
                    }}
                    className={`flex items-center justify-center rounded-xl p-2 transition-all ${
                      icon === ic
                        ? 'scale-105 bg-blue-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={ic}
                  >
                    <IconRenderer name={ic} className="h-5 w-5" />
                  </button>
                ))}
                {filteredIcons.length === 0 && (
                  <div className="col-span-5 py-4 text-center text-xs text-slate-400">
                    Kein Icon gefunden
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Title / Name Input */}
        <div className="flex-1">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            {nameLabel}
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            className="h-10 w-full rounded-xl border border-slate-300 px-3.5 text-sm font-medium text-slate-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Darunter: Beschreibung (optional) */}
      {setDescription && (
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-slate-700">
            Beschreibung (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Notiz, Zweck oder Details..."
            className="h-10 w-full rounded-xl border border-slate-300 px-3.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      )}
    </div>
  );
};
