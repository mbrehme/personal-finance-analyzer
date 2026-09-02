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
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Farbe
          </label>
          <button
            type="button"
            onClick={() => {
              setIsColorPickerOpen(!isColorPickerOpen);
              setIsIconPickerOpen(false);
            }}
            className="flex items-center gap-1.5 h-10 px-2.5 bg-white border border-slate-300 rounded-xl hover:border-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Farbe wählen"
          >
            <span
              className="w-5 h-5 rounded-full shadow-inner border border-black/10 flex items-center justify-center text-white"
              style={{ backgroundColor: color || '#3b82f6' }}
            />
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isColorPickerOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 p-3 bg-white rounded-2xl shadow-xl border border-slate-200 w-64 space-y-3 animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wider">
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
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm hover:scale-110 active:scale-95 transition-transform"
                    title={c}
                  >
                    {color.toLowerCase() === c.toLowerCase() && <Check className="w-5 h-5 stroke-[3]" />}
                  </button>
                ))}
              </div>

              {/* Custom Color Input */}
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-600 font-medium cursor-pointer">
                  <Pipette className="w-4 h-4 text-slate-500" />
                  Eigene Farbe:
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent"
                  />
                </label>
                <input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#000000"
                  className="w-20 px-2 py-1 font-mono text-xs border border-slate-300 rounded-lg text-slate-700 uppercase"
                />
              </div>
            </div>
          )}
        </div>

        {/* Icon Picker */}
        <div className="relative" ref={iconRef}>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Icon
          </label>
          <button
            type="button"
            onClick={() => {
              setIsIconPickerOpen(!isIconPickerOpen);
              setIsColorPickerOpen(false);
            }}
            className="flex items-center gap-1.5 h-10 px-2.5 bg-white border border-slate-300 rounded-xl hover:border-slate-400 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            title="Icon wählen"
          >
            <div
              className="w-6 h-6 rounded-lg flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: color || '#3b82f6' }}
            >
              <IconRenderer name={icon || 'Folder'} className="w-4 h-4" />
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {isIconPickerOpen && (
            <div className="absolute left-0 top-full mt-2 z-50 p-3 bg-white rounded-2xl shadow-xl border border-slate-200 w-72 space-y-2.5 animate-in fade-in-50 zoom-in-95 duration-100">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  value={iconSearch}
                  onChange={(e) => setIconSearch(e.target.value)}
                  placeholder="Icon suchen..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto p-1">
                {filteredIcons.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => {
                      setIcon(ic);
                      setIsIconPickerOpen(false);
                    }}
                    className={`p-2 rounded-xl flex items-center justify-center transition-all ${
                      icon === ic
                        ? 'bg-blue-600 text-white shadow-sm scale-105'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    title={ic}
                  >
                    <IconRenderer name={ic} className="w-5 h-5" />
                  </button>
                ))}
                {filteredIcons.length === 0 && (
                  <div className="col-span-5 text-center py-4 text-xs text-slate-400">
                    Kein Icon gefunden
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Title / Name Input */}
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            {nameLabel}
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={namePlaceholder}
            className="w-full h-10 px-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-medium text-slate-900 shadow-sm"
          />
        </div>
      </div>

      {/* Darunter: Beschreibung (optional) */}
      {setDescription && (
        <div>
          <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1">
            Beschreibung (optional)
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optionale Notiz, Zweck oder Details..."
            className="w-full h-9 px-3.5 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 text-xs text-slate-700 shadow-sm placeholder:text-slate-400"
          />
        </div>
      )}
    </div>
  );
};

