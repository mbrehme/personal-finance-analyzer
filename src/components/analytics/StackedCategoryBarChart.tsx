/**
 * @file StackedCategoryBarChart.tsx
 * @description Responsives Analyse-Widget für die Cashflow-Analyse.
 * Beinhaltet in einer gemeinsamen Box:
 * 1. Gestapeltes Balkendiagramm (Einnahmen über der Nulllinie, Ausgaben darunter) pro Zeiteinheit.
 * 2. Tortendiagramm / Donut-Chart mit den Durchschnittsausgaben der ausgewählten Kategorien.
 * Inklusive interaktiven Hover-Tooltips und Ein-/Ausklappbarkeit.
 * @module components/analytics/StackedCategoryBarChart
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { PeriodGranularity } from '@/types/finance';
import { CashflowAnalysisResult } from '@/services/analytics/cashflowCalculator';
import { formatPeriodLabel } from '@/utils/dateUtils';
import { formatMoney } from '@/utils/moneyUtils';
import { IconRenderer } from '@/components/IconRenderer';
import { BarChart3, PieChart as PieChartIcon, ChevronDown, ChevronUp } from 'lucide-react';

export interface StackedCategoryBarChartProps {
  /** Aggregiertes Cashflow-Ergebnis mit periodKeys, rows und uncategorizedRow */
  result: CashflowAnalysisResult;
  /** Aktuell gewählte Zeitgranularität */
  granularity: PeriodGranularity;
  /** Optionale CSS-Klassen für den Container */
  className?: string;
  /** Anzeigemodus: Nach Kategorien oder Konten gruppiert (Standard: 'categories') */
  mode?: 'categories' | 'accounts';
}

interface CategorySliceInfo {
  id: string;
  name: string;
  fullName: string;
  color: string;
  icon?: string;
  amount: number; // positiver Betrag für die Skalierung
  net: number; // echter vorzeichenbehafteter Betrag
}

interface HoveredSlice {
  periodKey: string;
  periodLabel: string;
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  amount: number;
  net: number;
  sharePercent: number;
  periodTotal: number;
  periodNet: number;
  x: number;
  y: number;
}

interface DonutSliceInfo {
  id: string;
  name: string;
  fullName: string;
  color: string;
  icon?: string;
  avgAmount: number;
  totalAmount: number;
  sharePercent: number;
  pathD: string;
  net: number;
}

interface HoveredDonutSlice {
  id: string;
  name: string;
  fullName: string;
  color: string;
  icon?: string;
  avgAmount: number;
  totalAmount: number;
  sharePercent: number;
  x: number;
  y: number;
  net: number;
}

const STORAGE_COLLAPSED_KEY = 'cashflow_chart_collapsed';
const UNCATEGORIZED_ID = '__uncategorized__';
const UNCATEGORIZED_COLOR = '#94a3b8'; // slate-400

/**
 * Erzeugt eine gerundete, lesbare Schrittweite für die Y-Achse.
 */
function getNiceStep(maxValue: number, tickCount = 3): number {
  if (maxValue <= 0) return 100;
  const roughStep = maxValue / tickCount;
  const power = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalized = roughStep / power;
  let niceFactor = 1;
  if (normalized > 5) niceFactor = 10;
  else if (normalized > 2) niceFactor = 5;
  else if (normalized > 1) niceFactor = 2;

  return niceFactor * power;
}

/**
 * Berechnet den SVG-Pfad eines Donut-Slices (Ring-Segment).
 */
function describeDonutSlice(
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
): string {
  const angleDiff = endAngle - startAngle;
  if (angleDiff >= 2 * Math.PI - 0.001) {
    return [
      `M ${cx} ${cy - rOuter}`,
      `A ${rOuter} ${rOuter} 0 1 0 ${cx} ${cy + rOuter}`,
      `A ${rOuter} ${rOuter} 0 1 0 ${cx} ${cy - rOuter}`,
      `M ${cx} ${cy - rInner}`,
      `A ${rInner} ${rInner} 0 1 1 ${cx} ${cy + rInner}`,
      `A ${rInner} ${rInner} 0 1 1 ${cx} ${cy - rInner}`,
      'Z',
    ].join(' ');
  }

  const x1 = cx + rOuter * Math.cos(startAngle);
  const y1 = cy + rOuter * Math.sin(startAngle);
  const x2 = cx + rOuter * Math.cos(endAngle);
  const y2 = cy + rOuter * Math.sin(endAngle);

  const x3 = cx + rInner * Math.cos(endAngle);
  const y3 = cy + rInner * Math.sin(endAngle);
  const x4 = cx + rInner * Math.cos(startAngle);
  const y4 = cy + rInner * Math.sin(startAngle);

  const largeArc = angleDiff > Math.PI ? 1 : 0;

  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

export const StackedCategoryBarChart: React.FC<StackedCategoryBarChartProps> = ({
  result,
  granularity,
  className = '',
  mode = 'categories',
}) => {
  // Ein-/Ausklapp-Zustand (gemerkt in localStorage)
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    return localStorage.getItem(STORAGE_COLLAPSED_KEY) === 'true';
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  // Map der übergeordneten Kategorien zur klaren Namensdarstellung (z. B. "Ausgaben > Lebensmittel")
  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    result.rows.forEach((r) => {
      if (r.category.parentId) {
        const parentRow = result.rows.find((p) => p.category.id === r.category.parentId);
        if (parentRow) {
          map.set(r.category.id, parentRow.category.name);
        }
      }
    });
    return map;
  }, [result.rows]);

  // Alle einzelnen Kategorien ermitteln (Blatt-Kategorien im aktuellen gefilterten Set),
  // damit jede Kategorie ihren eigenen Stapel hat und keine Doppelzählungen durch Sammelordner entstehen.
  // Eine Kategorie wird nur dann als Sammelordner übersprungen, wenn mindestens eines ihrer Kinder
  // ebenfalls im aktuellen gefilterten Set (result.rows) enthalten ist.
  const individualCategoryRows = useMemo(() => {
    const parentIdsInResult = new Set(result.rows.map((r) => r.category.parentId).filter(Boolean));
    const leaves = result.rows.filter((r) => !parentIdsInResult.has(r.category.id));
    return leaves.length > 0 ? leaves : result.rows;
  }, [result.rows]);

  // Hover-Zustände für Tooltips
  const [hoveredSlice, setHoveredSlice] = useState<HoveredSlice | null>(null);
  const [hoveredDonutSlice, setHoveredDonutSlice] = useState<HoveredDonutSlice | null>(null);
  const [activeDonutId, setActiveDonutId] = useState<string | null>(null);

  const periodKeys = result.periodKeys;
  const numPeriods = Math.max(1, periodKeys.length);

  const granularityLabel =
    granularity === 'monthly'
      ? 'Monat'
      : granularity === 'quarterly'
        ? 'Quartal'
        : granularity === 'halfYearly'
          ? 'Halbjahr'
          : 'Jahr';

  // 1. Daten für das gestapelte Balkendiagramm
  const barChartData = useMemo(() => {
    let globalMaxPositive = 0;
    let globalMaxNegative = 0;

    const periodsData = periodKeys.map((pKey) => {
      const positiveSlices: CategorySliceInfo[] = [];
      const negativeSlices: CategorySliceInfo[] = [];

      let positiveSum = 0;
      let negativeSum = 0;

      // Einzelne Kategorien verarbeiten
      individualCategoryRows.forEach((r) => {
        const p = r.periods[pKey];
        if (!p || p.net === 0) return;

        const parentName = parentMap.get(r.category.id);
        const fullName = parentName ? `${parentName} > ${r.category.name}` : r.category.name;

        if (p.net > 0) {
          positiveSlices.push({
            id: r.category.id,
            name: r.category.name,
            fullName,
            color: r.category.color || '#3b82f6',
            icon: r.category.icon || 'Folder',
            amount: p.net,
            net: p.net,
          });
          positiveSum += p.net;
        } else {
          const absAmount = Math.abs(p.net);
          negativeSlices.push({
            id: r.category.id,
            name: r.category.name,
            fullName,
            color: r.category.color || '#3b82f6',
            icon: r.category.icon || 'Folder',
            amount: absAmount,
            net: p.net,
          });
          negativeSum += absAmount;
        }
      });

      // Unkategorisiert verarbeiten
      const u = result.uncategorizedRow.periods[pKey];
      if (u && u.net !== 0) {
        if (u.net > 0) {
          positiveSlices.push({
            id: UNCATEGORIZED_ID,
            name: 'Nicht kategorisiert',
            fullName: 'Nicht kategorisiert',
            color: UNCATEGORIZED_COLOR,
            icon: 'HelpCircle',
            amount: u.net,
            net: u.net,
          });
          positiveSum += u.net;
        } else {
          const absAmount = Math.abs(u.net);
          negativeSlices.push({
            id: UNCATEGORIZED_ID,
            name: 'Nicht kategorisiert',
            fullName: 'Nicht kategorisiert',
            color: UNCATEGORIZED_COLOR,
            icon: 'HelpCircle',
            amount: absAmount,
            net: u.net,
          });
          negativeSum += absAmount;
        }
      }

      if (positiveSum > globalMaxPositive) globalMaxPositive = positiveSum;
      if (negativeSum > globalMaxNegative) globalMaxNegative = negativeSum;

      return {
        pKey,
        label: formatPeriodLabel(pKey, granularity),
        positiveSlices,
        negativeSlices,
        positiveSum,
        negativeSum,
        netTotal: positiveSum - negativeSum,
      };
    });

    return {
      periodsData,
      maxPositive: globalMaxPositive,
      maxNegative: globalMaxNegative,
    };
  }, [periodKeys, individualCategoryRows, result.uncategorizedRow, parentMap, granularity]);

  // 2. Daten für das Tortendiagramm / Donut-Chart (Durchschnittliche Verteilung pro Zeiteinheit)
  const donutData = useMemo(() => {
    const rawSlices: Array<{
      id: string;
      name: string;
      fullName: string;
      color: string;
      icon?: string;
      avgAmount: number;
      totalAmount: number;
      net: number;
    }> = [];

    // Einzelne Kategorien / Konten
    individualCategoryRows.forEach((r) => {
      // Effektiver Betrag: Netto-Betrag (oder Gesamtvolumen, falls Netto 0 ist aber Buchungen vorliegen)
      const netAmount = r.totalNet;
      const effectiveAmount =
        Math.abs(netAmount) > 0 ? Math.abs(netAmount) : r.totalInbound + Math.abs(r.totalOutbound);

      if (effectiveAmount > 0) {
        const parentName = parentMap.get(r.category.id);
        const fullName = parentName ? `${parentName} > ${r.category.name}` : r.category.name;
        rawSlices.push({
          id: r.category.id,
          name: r.category.name,
          fullName,
          color: r.category.color || '#3b82f6',
          icon: r.category.icon || (mode === 'accounts' ? 'Landmark' : 'Folder'),
          avgAmount: effectiveAmount / numPeriods,
          totalAmount: effectiveAmount,
          net: netAmount,
        });
      }
    });

    // Unkategorisiert (nur im Kategorien-Modus relevant)
    if (mode === 'categories') {
      const uncatNet = result.uncategorizedRow.totalNet;
      const uncatEffective =
        Math.abs(uncatNet) > 0
          ? Math.abs(uncatNet)
          : result.uncategorizedRow.totalInbound + Math.abs(result.uncategorizedRow.totalOutbound);

      if (uncatEffective > 0) {
        rawSlices.push({
          id: UNCATEGORIZED_ID,
          name: 'Nicht kategorisiert',
          fullName: 'Nicht kategorisiert',
          color: UNCATEGORIZED_COLOR,
          icon: 'HelpCircle',
          avgAmount: uncatEffective / numPeriods,
          totalAmount: uncatEffective,
          net: uncatNet,
        });
      }
    }

    // Absteigend nach Durchschnittsbetrag sortieren
    rawSlices.sort((a, b) => b.avgAmount - a.avgAmount);

    const totalAvgAmount = rawSlices.reduce((sum, s) => sum + s.avgAmount, 0);

    // Geometrie Donut: Zentrum (90, 90), rOuter = 72, rInner = 46
    const cx = 90;
    const cy = 90;
    const rOuter = 72;
    const rInner = 46;

    let currentAngle = -Math.PI / 2; // 12 Uhr Start
    const slices: DonutSliceInfo[] = rawSlices.map((s) => {
      const sharePercent = totalAvgAmount > 0 ? (s.avgAmount / totalAvgAmount) * 100 : 0;
      const angleSpan = totalAvgAmount > 0 ? (s.avgAmount / totalAvgAmount) * (2 * Math.PI) : 0;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angleSpan;
      currentAngle = endAngle;

      const pathD = describeDonutSlice(cx, cy, rOuter, rInner, startAngle, endAngle);

      return {
        ...s,
        sharePercent,
        pathD,
      };
    });

    return {
      slices,
      totalAvgAmount,
      cx,
      cy,
    };
  }, [individualCategoryRows, parentMap, result.uncategorizedRow, numPeriods, mode]);

  // Container-Breite dynamisch messen, damit das Balkendiagramm die gesamte verfügbare Breite ausfüllt
  const barChartContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);

  useEffect(() => {
    const el = barChartContainerRef.current;
    if (!el) return;

    const handleResize = () => {
      setContainerWidth(el.clientWidth);
    };

    handleResize();

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width);
          }
        }
      });
      observer.observe(el);
      return () => observer.disconnect();
    } else {
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Balkendiagramm Geometrie
  const chartHeight = 260;
  const marginTop = 20;
  const marginBottom = 34;
  const marginLeft = 65;
  const marginRight = 20;

  const innerHeight = chartHeight - marginTop - marginBottom;
  const totalPeriods = barChartData.periodsData.length;

  const minBarSlotWidth = 44;
  const minRequiredWidth = marginLeft + marginRight + totalPeriods * minBarSlotWidth;
  const barChartWidth = Math.max(containerWidth || 0, minRequiredWidth, 500);

  const availableBarArea = barChartWidth - marginLeft - marginRight;
  const barSlotWidth = totalPeriods > 0 ? availableBarArea / totalPeriods : 60;

  const maxPositive = barChartData.maxPositive;
  const maxNegative = barChartData.maxNegative;
  const isBarChartEmpty = maxPositive === 0 && maxNegative === 0;

  const positiveStep = getNiceStep(maxPositive, 3);
  const negativeStep = getNiceStep(maxNegative, 3);

  const roundedMaxPositive = Math.max(
    positiveStep,
    Math.ceil(maxPositive / positiveStep) * positiveStep
  );
  const roundedMaxNegative = Math.max(
    negativeStep,
    Math.ceil(maxNegative / negativeStep) * negativeStep
  );

  const totalRange = roundedMaxPositive + roundedMaxNegative;
  const yZero = marginTop + (roundedMaxPositive / totalRange) * innerHeight;

  const getYCoord = (val: number): number => {
    if (val >= 0) {
      return yZero - (val / roundedMaxPositive) * (yZero - marginTop);
    }
    return yZero + (Math.abs(val) / roundedMaxNegative) * (chartHeight - marginBottom - yZero);
  };

  const yTicks = useMemo(() => {
    const ticks: number[] = [];
    if (isBarChartEmpty) return [0];

    for (let v = positiveStep; v <= roundedMaxPositive; v += positiveStep) {
      ticks.push(v);
    }
    ticks.push(0);
    for (let v = negativeStep; v <= roundedMaxNegative; v += negativeStep) {
      ticks.push(-v);
    }
    return ticks.sort((a, b) => b - a);
  }, [positiveStep, negativeStep, roundedMaxPositive, roundedMaxNegative, isBarChartEmpty]);

  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition-all ${className}`}
      data-testid="stacked-category-barchart"
    >
      {/* Header mit Titel und Ein-/Ausklapp-Button */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
              Cashflow & Ø Verteilung nach {mode === 'accounts' ? 'Konten' : 'Kategorien'}
            </h2>
            <p className="text-xs text-slate-400">
              Gestapelter Verlauf über/unter der Nulllinie und durchschnittliche Verteilung pro{' '}
              {granularityLabel}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleCollapse}
            className="shadow-xs flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
            title={isCollapsed ? 'Diagramme einblenden' : 'Diagramme ausblenden'}
            aria-label={isCollapsed ? 'Diagramme einblenden' : 'Diagramme ausblenden'}
          >
            {isCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Ausklappbarer Body */}
      {!isCollapsed && (
        <div className="p-5">
          {isBarChartEmpty && donutData.slices.length === 0 ? (
            <div className="flex h-44 flex-col items-center justify-center text-slate-400">
              <BarChart3 className="mb-2 h-8 w-8 text-slate-300" />
              <p className="text-sm font-medium">
                Keine Buchungen im ausgewählten Zeitraum vorhanden.
              </p>
              <p className="text-xs text-slate-400">
                Passe ggf. den Datumsbereich, Konto- oder Kategorie-Filter an.
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-stretch gap-6 lg:flex-row">
              {/* Linke Seite: Gestapeltes Balkendiagramm (nimmt gesamten restlichen Bereich ein) */}
              <div ref={barChartContainerRef} className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                  <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                  <span>Cashflow-Verlauf pro {granularityLabel}</span>
                </div>

                <div className="relative w-full">
                  <div className="w-full overflow-x-auto pb-1">
                    <svg
                      data-testid="chart-svg"
                      width={barChartWidth}
                      height={chartHeight}
                      className="w-full select-none overflow-visible"
                      style={{ minWidth: `${barChartWidth}px` }}
                      onMouseLeave={() => setHoveredSlice(null)}
                    >
                      {/* Horizontale Rasterlinien & Y-Achsen Labels */}
                      {yTicks.map((tickVal) => {
                        const y = getYCoord(tickVal);
                        const isZero = tickVal === 0;
                        return (
                          <g key={tickVal}>
                            <line
                              x1={marginLeft}
                              y1={y}
                              x2={barChartWidth - marginRight}
                              y2={y}
                              stroke={isZero ? '#64748b' : '#f1f5f9'}
                              strokeWidth={isZero ? 1.5 : 1}
                              strokeDasharray={isZero ? undefined : '3,3'}
                            />
                            <text
                              x={marginLeft - 8}
                              y={y + 3.5}
                              textAnchor="end"
                              className={`font-mono text-[10px] ${
                                isZero ? 'fill-slate-800 font-bold' : 'fill-slate-400'
                              }`}
                            >
                              {formatMoney(tickVal)}
                            </text>
                          </g>
                        );
                      })}

                      {/* Perioden Säulen: Positive Slices nach oben, Negative Slices nach unten */}
                      {barChartData.periodsData.map((pd, pIdx) => {
                        const slotX = marginLeft + pIdx * barSlotWidth;
                        const barWidth = Math.min(barSlotWidth * 0.65, 44);
                        const barX = slotX + (barSlotWidth - barWidth) / 2;

                        // 1. Positive Slices (Einnahmen, stack up from yZero)
                        let currentPosY = yZero;
                        const renderedPositive = pd.positiveSlices.map((slice, sIdx) => {
                          const sliceHeight =
                            roundedMaxPositive > 0
                              ? (slice.amount / roundedMaxPositive) * (yZero - marginTop)
                              : 0;
                          const sliceY = currentPosY - sliceHeight;
                          currentPosY = sliceY;

                          const isHovered =
                            hoveredSlice?.periodKey === pd.pKey &&
                            hoveredSlice?.categoryId === slice.id;

                          const isTopSlice = sIdx === pd.positiveSlices.length - 1;

                          return (
                            <rect
                              key={`pos-${slice.id}`}
                              x={barX}
                              y={sliceY}
                              width={barWidth}
                              height={Math.max(sliceHeight, 1)}
                              fill={slice.color}
                              rx={isTopSlice ? 3 : 0}
                              ry={isTopSlice ? 3 : 0}
                              className="cursor-pointer transition-all duration-150"
                              style={{
                                opacity: isHovered ? 1 : 0.92,
                                filter: isHovered
                                  ? 'brightness(1.15) drop-shadow(0 2px 5px rgba(0,0,0,0.2))'
                                  : undefined,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredSlice({
                                  periodKey: pd.pKey,
                                  periodLabel: pd.label,
                                  categoryId: slice.id,
                                  categoryName: slice.fullName,
                                  categoryColor: slice.color,
                                  categoryIcon: slice.icon,
                                  amount: slice.amount,
                                  net: slice.net,
                                  sharePercent:
                                    pd.positiveSum > 0 ? (slice.amount / pd.positiveSum) * 100 : 0,
                                  periodTotal: pd.positiveSum,
                                  periodNet: pd.netTotal,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                            />
                          );
                        });

                        // 2. Negative Slices (Ausgaben, stack down from yZero)
                        let currentNegY = yZero;
                        const renderedNegative = pd.negativeSlices.map((slice, sIdx) => {
                          const sliceHeight =
                            roundedMaxNegative > 0
                              ? (slice.amount / roundedMaxNegative) *
                                (chartHeight - marginBottom - yZero)
                              : 0;
                          const sliceY = currentNegY;
                          currentNegY += sliceHeight;

                          const isHovered =
                            hoveredSlice?.periodKey === pd.pKey &&
                            hoveredSlice?.categoryId === slice.id;

                          const isBottomSlice = sIdx === pd.negativeSlices.length - 1;

                          return (
                            <rect
                              key={`neg-${slice.id}`}
                              x={barX}
                              y={sliceY}
                              width={barWidth}
                              height={Math.max(sliceHeight, 1)}
                              fill={slice.color}
                              rx={isBottomSlice ? 3 : 0}
                              ry={isBottomSlice ? 3 : 0}
                              className="cursor-pointer transition-all duration-150"
                              style={{
                                opacity: isHovered ? 1 : 0.92,
                                filter: isHovered
                                  ? 'brightness(1.15) drop-shadow(0 2px 5px rgba(0,0,0,0.2))'
                                  : undefined,
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setHoveredSlice({
                                  periodKey: pd.pKey,
                                  periodLabel: pd.label,
                                  categoryId: slice.id,
                                  categoryName: slice.fullName,
                                  categoryColor: slice.color,
                                  categoryIcon: slice.icon,
                                  amount: slice.amount,
                                  net: slice.net,
                                  sharePercent:
                                    pd.negativeSum > 0 ? (slice.amount / pd.negativeSum) * 100 : 0,
                                  periodTotal: pd.negativeSum,
                                  periodNet: pd.netTotal,
                                  x: rect.left + rect.width / 2,
                                  y: rect.bottom,
                                });
                              }}
                            />
                          );
                        });

                        return (
                          <g key={pd.pKey}>
                            {renderedPositive}
                            {renderedNegative}

                            {/* X-Achse Beschriftung */}
                            <text
                              x={slotX + barSlotWidth / 2}
                              y={chartHeight - 10}
                              textAnchor="middle"
                              className="fill-slate-600 font-sans text-[11px] font-medium"
                            >
                              {pd.label}
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>

                  {/* Interaktiver Bar-Tooltip */}
                  {hoveredSlice && (
                    <div
                      className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
                      style={{
                        left: `${hoveredSlice.x}px`,
                        top: `${hoveredSlice.y - 10}px`,
                      }}
                      data-testid="chart-slice-tooltip"
                    >
                      <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {hoveredSlice.periodLabel}
                      </div>

                      <div className="flex items-center gap-2">
                        <div
                          className="shadow-xs flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                          style={{ backgroundColor: hoveredSlice.categoryColor }}
                        >
                          <IconRenderer name={hoveredSlice.categoryIcon} className="h-3 w-3" />
                        </div>
                        <span className="text-xs font-semibold text-slate-900">
                          {hoveredSlice.categoryName}
                        </span>
                      </div>

                      <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-1.5 font-mono text-xs">
                        <div className="flex justify-between gap-4">
                          <span className="text-slate-500">Betrag:</span>
                          <span
                            className={`font-bold ${
                              hoveredSlice.net >= 0 ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {formatMoney(hoveredSlice.net)}
                          </span>
                        </div>

                        <div className="flex justify-between gap-4 text-[11px] text-slate-500">
                          <span>Anteil an {hoveredSlice.net >= 0 ? 'Einnahmen' : 'Ausgaben'}:</span>
                          <span className="font-medium text-slate-700">
                            {hoveredSlice.sharePercent.toFixed(1)}%
                          </span>
                        </div>

                        <div className="flex justify-between gap-4 border-t border-slate-100 pt-1 text-[11px] text-slate-600">
                          <span>Netto-Gesamtsaldo:</span>
                          <span
                            className={`font-bold ${
                              hoveredSlice.periodNet >= 0 ? 'text-emerald-600' : 'text-slate-900'
                            }`}
                          >
                            {formatMoney(hoveredSlice.periodNet)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Rechte Seite: Tortendiagramm / Donut-Chart (Durchschnittsausgaben) */}
              <div className="flex w-full shrink-0 flex-col border-t border-slate-100 pt-4 lg:w-72 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 xl:w-80">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <PieChartIcon className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Ø Verteilung pro {granularityLabel}</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-900">
                    {formatMoney(donutData.totalAvgAmount)}
                  </span>
                </div>

                {donutData.slices.length === 0 ? (
                  <div
                    className="flex h-56 flex-col items-center justify-center text-center text-slate-400"
                    data-testid="donut-empty-state"
                  >
                    <PieChartIcon className="mb-1.5 h-7 w-7 text-slate-300" />
                    <p className="text-xs font-medium">Keine Daten im ausgewählten Zeitraum.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    {/* SVG Donut */}
                    <div className="relative flex justify-center">
                      <svg
                        data-testid="donut-chart-svg"
                        width="180"
                        height="180"
                        viewBox="0 0 180 180"
                        className="overflow-visible"
                        onMouseLeave={() => {
                          setHoveredDonutSlice(null);
                          setActiveDonutId(null);
                        }}
                      >
                        {donutData.slices.map((slice) => {
                          const isHovered =
                            activeDonutId === slice.id || hoveredDonutSlice?.id === slice.id;

                          return (
                            <path
                              key={`donut-${slice.id}`}
                              d={slice.pathD}
                              fill={slice.color}
                              stroke="#ffffff"
                              strokeWidth="1.5"
                              className="cursor-pointer transition-all duration-150"
                              style={{
                                filter: isHovered
                                  ? 'brightness(1.15) drop-shadow(0 2px 5px rgba(0,0,0,0.25))'
                                  : undefined,
                                transform: isHovered ? 'scale(1.03)' : undefined,
                                transformOrigin: '90px 90px',
                              }}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                setActiveDonutId(slice.id);
                                setHoveredDonutSlice({
                                  ...slice,
                                  x: rect.left + rect.width / 2,
                                  y: rect.top,
                                });
                              }}
                            />
                          );
                        })}

                        {/* Zentrums-Text */}
                        <text
                          x={donutData.cx}
                          y={donutData.cy - 8}
                          textAnchor="middle"
                          className="fill-slate-400 font-sans text-[9px] font-semibold uppercase tracking-wider"
                        >
                          Ø Gesamt
                        </text>
                        <text
                          x={donutData.cx}
                          y={donutData.cy + 10}
                          textAnchor="middle"
                          className="fill-slate-900 font-mono text-xs font-bold"
                        >
                          {formatMoney(donutData.totalAvgAmount)}
                        </text>
                        <text
                          x={donutData.cx}
                          y={donutData.cy + 22}
                          textAnchor="middle"
                          className="fill-slate-400 font-sans text-[9px]"
                        >
                          /{granularityLabel}
                        </text>
                      </svg>

                      {/* Donut Hover Tooltip */}
                      {hoveredDonutSlice && (
                        <div
                          className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-full rounded-xl border border-slate-200 bg-white p-3 shadow-xl ring-1 ring-black/5"
                          style={{
                            left: `${hoveredDonutSlice.x}px`,
                            top: `${hoveredDonutSlice.y - 10}px`,
                          }}
                          data-testid="donut-slice-tooltip"
                        >
                          <div className="flex items-center gap-2">
                            <div
                              className="shadow-xs flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-white"
                              style={{ backgroundColor: hoveredDonutSlice.color }}
                            >
                              <IconRenderer name={hoveredDonutSlice.icon} className="h-3 w-3" />
                            </div>
                            <span className="text-xs font-semibold text-slate-900">
                              {hoveredDonutSlice.name}
                            </span>
                          </div>

                          <div className="mt-2 space-y-0.5 border-t border-slate-100 pt-1.5 font-mono text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-slate-500">Ø pro {granularityLabel}:</span>
                              <span className="font-bold text-slate-900">
                                {formatMoney(hoveredDonutSlice.avgAmount)}
                              </span>
                            </div>

                            <div className="flex justify-between gap-4 text-[11px] text-slate-500">
                              <span>Anteil:</span>
                              <span className="font-medium text-slate-700">
                                {hoveredDonutSlice.sharePercent.toFixed(1)}%
                              </span>
                            </div>

                            <div className="flex justify-between gap-4 border-t border-slate-100 pt-1 text-[11px] text-slate-600">
                              <span>Gesamt im Zeitraum:</span>
                              <span className="font-semibold text-slate-800">
                                {formatMoney(hoveredDonutSlice.totalAmount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Legende der Kategorien mit Prozentwerten und Beträgen */}
                    <div
                      className="mt-3 max-h-44 w-full space-y-1 overflow-y-auto pr-1"
                      data-testid="donut-legend"
                    >
                      {donutData.slices.map((slice) => {
                        const isActive = activeDonutId === slice.id;
                        return (
                          <div
                            key={`legend-${slice.id}`}
                            onMouseEnter={() => setActiveDonutId(slice.id)}
                            onMouseLeave={() => setActiveDonutId(null)}
                            className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1 transition-colors ${
                              isActive ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <div
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: slice.color }}
                              />
                              <span
                                className="truncate text-xs text-slate-700"
                                title={slice.fullName}
                              >
                                {slice.name}
                              </span>
                            </div>
                            <div className="flex shrink-0 items-center gap-2 font-mono text-[11px]">
                              <span className="text-slate-400">
                                {slice.sharePercent.toFixed(1)}%
                              </span>
                              <span className="font-semibold text-slate-800">
                                {formatMoney(slice.avgAmount)}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
