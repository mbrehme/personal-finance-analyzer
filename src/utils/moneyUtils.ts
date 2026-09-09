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
 * Formatiert einen Geldbetrag für die Eingabe in MoneyInput (deutsches Format ohne Währungssymbol).
 * Ganze Zahlen werden als "100" bzw. "2.500" formatiert, Dezimalbeträge mit exakt zwei Dezimalstellen (z. B. "16.930,02").
 * Bei 0 oder ungültigen Werten wird ein leerer String zurückgegeben.
 *
 * @param {number} value - Der Geldbetrag
 * @returns {string} Formatierter Eingabewert
 *
 * @example
 * formatAmountForInput(0) // ""
 * formatAmountForInput(100) // "100"
 * formatAmountForInput(16930.02) // "16.930,02"
 * formatAmountForInput(150.5) // "150,50"
 */
export function formatAmountForInput(value: number): string {
  if (value === 0 || isNaN(value)) return '';
  if (Number.isInteger(value)) {
    return value.toLocaleString('de-DE');
  }
  return value.toLocaleString('de-DE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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

/**
 * Parst einen Währungs- oder Betragsstring flexibel und fehlertolerant in eine Fließkommazahl.
 * Unterstützt deutsche (1.234,56 € / 16.930,02) und internationale (1,234.56) Formate,
 * Tausendertrennzeichen (Punkte, Kommas, Apostrophe, Leerzeichen),
 * vor- und nachgestellte Vorzeichen (+, -, S, H, DB, CR, Buchhaltungsklammern)
 * sowie Währungssymbole.
 *
 * @param {string} raw - Der rohe Eingabestring (z. B. "16.930,02", "1.250,50 €", "-45,99")
 * @returns {number} Der berechnete Betrag gerundet auf 2 Nachkommastellen
 *
 * @example
 * parseCurrencyValue('16.930,02') // 16930.02
 * parseCurrencyValue('1.250,50 €') // 1250.5
 * parseCurrencyValue('-45,99') // -45.99
 * parseCurrencyValue('2.500') // 2500
 * parseCurrencyValue('12,50') // 12.5
 */
export function parseCurrencyValue(raw: string): number {
  if (!raw) return 0;

  const trimmed = raw.trim();
  if (!trimmed) return 0;

  // 1. Vorzeichen ermitteln
  // Buchhaltungs-Klammern: (1.234,56)
  const isParenthesesNegative = /^\(.*\)$/.test(trimmed);

  // Vor- oder nachgestelltes Minus: -2.500 oder 2.500-
  const hasMinus = /^-/.test(trimmed) || /-$/.test(trimmed);

  // Soll/Haben-Kennzeichen (S = Soll/Minus, H = Haben/Plus, DB = Debit/Minus, CR = Credit/Plus)
  // Währungskürzel vorab ignorieren (z. B. USD enthält kein Soll-S)
  const withoutCurrencyCodes = trimmed.replace(/\b(EUR|USD|CHF|GBP)\b/gi, '');
  const hasDebitIndicator =
    /(?:^|\s|\d)(s|soll|db|debit)\s*$/i.test(withoutCurrencyCodes) ||
    /^\s*(s|soll|db|debit)\s+/i.test(withoutCurrencyCodes);

  const isNegative = isParenthesesNegative || hasMinus || hasDebitIndicator;

  // 2. Bereinigen von Währungssymbolen, Buchstaben, Leerzeichen und Apostrophen
  // Schweizer Apostroph (' oder ’) sowie Tausender-Leerzeichen entfernen
  let cleaned = trimmed
    .replace(/[€$£¥₹\u00A4]/g, '')
    .replace(/\b(EUR|USD|CHF|GBP|soll|haben|s|h|db|cr|debit|credit)\b/gi, '')
    .replace(/['’\s\u00A0\u202F]/g, '')
    .replace(/[()+\-]/g, '')
    .trim();

  // Nur noch Ziffern, Punkte und Kommas behalten
  cleaned = cleaned.replace(/[^\d.,]/g, '');
  if (!cleaned) return 0;

  const dotCount = (cleaned.match(/\./g) || []).length;
  const commaCount = (cleaned.match(/,/g) || []).length;

  if (dotCount > 0 && commaCount > 0) {
    // Sowohl Punkt als auch Komma vorhanden:
    // Der letzte Separator bestimmt die Dezimaltrennstelle
    const lastDot = cleaned.lastIndexOf('.');
    const lastComma = cleaned.lastIndexOf(',');

    if (lastDot < lastComma) {
      // Europäisches Format: 1.234.567,89 oder 2.500,50 oder 16.930,02
      // Punkte als Tausendertrenner entfernen, Komma zu Dezimalpunkt
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK Format: 1,234,567.89 oder 2,500.50 oder 16,930.02
      // Kommas als Tausendertrenner entfernen
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (dotCount > 0) {
    // Nur Punkte vorhanden (kein Komma)
    if (dotCount > 1) {
      // Mehrere Punkte sind immer Tausendertrennzeichen (z. B. 1.000.000 oder 1.234.567)
      cleaned = cleaned.replace(/\./g, '');
    } else {
      // Genau ein Punkt: "2.500" vs. "12.50" vs. "12.5" vs. "0.500"
      const [integerPart, fractionalPart] = cleaned.split('.');
      // In Bank-/Währungskontexten haben Währungen 2 Dezimalstellen (Cents).
      // Ein Punkt gefolgt von exakt 3 Ziffern (bei Vorkommateil ungleich 0)
      // ist ein deutsches Tausendertrennzeichen (z. B. 2.500 oder 25.000)!
      if (fractionalPart.length === 3 && integerPart !== '0' && integerPart.length > 0) {
        cleaned = integerPart + fractionalPart;
      } else {
        // Regulärer Dezimalpunkt (z. B. 12.50, 12.5, 0.99, 0.500)
        cleaned = `${integerPart}.${fractionalPart}`;
      }
    }
  } else if (commaCount > 0) {
    // Nur Kommas vorhanden (kein Punkt)
    if (commaCount > 1) {
      // Mehrere Kommas sind immer Tausendertrennzeichen (z. B. 1,000,000)
      cleaned = cleaned.replace(/,/g, '');
    } else {
      // Genau ein Komma: "12,50" vs. "12,5" vs. "2,500" vs. "0,99"
      const [integerPart, fractionalPart] = cleaned.split(',');
      // Falls Komma gefolgt von exakt 3 Ziffern (bei Vorkomma != 0): Tausendertrennzeichen (z. B. 2,500)
      if (fractionalPart.length === 3 && integerPart !== '0' && integerPart.length > 0) {
        cleaned = integerPart + fractionalPart;
      } else {
        // Deutsches Dezimalkomma (z. B. 12,50 oder 12,5 oder 0,99)
        cleaned = `${integerPart}.${fractionalPart}`;
      }
    }
  }

  const num = parseFloat(cleaned);
  if (isNaN(num)) return 0;

  const finalNum = isNegative ? -Math.abs(num) : Math.abs(num);
  return finalNum === 0 ? 0 : roundToTwoDecimals(finalNum);
}
