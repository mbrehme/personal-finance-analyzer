/**
 * @file moneyUtils.ts
 * @description Hilfsfunktionen für die standardisierte Formatierung und Rundung von Geldbeträgen
 * mit immer zwei Nachkommastellen (de-DE Währungsformatierung).
 * @module utils/moneyUtils
 */

/**
 * Optionen für die Geldformatierung.
 */
export interface FormatMoneyOptions {
  /** Vorzeichen-Verhalten (z. B. 'always' für +12,00 € / -12,00 €) */
  signDisplay?: 'auto' | 'always' | 'never' | 'exceptZero';
  /** Ob das Währungssymbol (€) ausgegeben werden soll (Standard: true) */
  withSymbol?: boolean;
}

/**
 * Formatiert einen Geldbetrag konsistent mit deutschem Format und exakt zwei Nachkommastellen (z. B. "1.234,56 €").
 *
 * @param {number} amount - Der zu formatierende Geldbetrag
 * @param {FormatMoneyOptions} [options] - Optionale Formatierungseinstellungen
 * @returns {string} Formatierter Währungsstring
 *
 * @example
 * formatMoney(1200) // "1.200,00 €"
 * formatMoney(1200.5) // "1.200,50 €"
 * formatMoney(-50, { signDisplay: 'always' }) // "-50,00 €"
 * formatMoney(50, { signDisplay: 'always' }) // "+50,00 €"
 * formatMoney(50, { withSymbol: false }) // "50,00"
 */
export function formatMoney(amount: number, options?: FormatMoneyOptions): string {
  const { signDisplay = 'auto', withSymbol = true } = options || {};

  if (!withSymbol) {
    return amount.toLocaleString('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      signDisplay,
    });
  }

  return amount.toLocaleString('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    signDisplay,
  });
}

/**
 * Rundet einen Geldbetrag kaufmännisch exakt auf zwei Nachkommastellen, um Fließkomma-Ungenauigkeiten zu vermeiden.
 *
 * @param {number} amount - Der zu rundende Betrag
 * @returns {number} Auf zwei Dezimalstellen gerundeter Wert
 *
 * @example
 * roundToTwoDecimals(12.3456) // 12.35
 * roundToTwoDecimals(210.68 * 12) // 2528.16
 */
export function roundToTwoDecimals(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}
