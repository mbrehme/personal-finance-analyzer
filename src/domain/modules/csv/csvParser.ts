/**
 * @file csvParser.ts
 * @description Universeller CSV-Parser für Bank- und Finanzexporte mit intelligenter Trennzeichen-
 * und Spaltenerkennung sowie typsicherer Datums- und Betragskonvertierung.
 * @module domain/modules/csv/csvParser
 */

import { ISODateString, Transaction, getTransactionType, normalizeIban } from '@/types/finance';
import { toISODateString } from '@/utils/dateUtils';
import { roundToTwoDecimals } from '@/utils/moneyUtils';

export interface CsvColumnMapping {
  /** Spalte für das Wertstellungsdatum (Valutadatum) */
  dateColumn: string;
  /** @deprecated Verwende dateColumn */
  valueDateColumn?: string;
  /** @deprecated Verwende dateColumn */
  bookingDateColumn?: string;
  issuerColumn?: string;
  receiverColumn?: string;
  subjectColumn: string;
  valueColumn: string;
  ibanColumn?: string;
  accountIbanColumn?: string;
  typeColumn?: string;
}

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  delimiter: string;
  suggestedMapping: CsvColumnMapping;
}

/**
 * Ermittelt das wahrscheinlichste Trennzeichen der CSV-Datei (;, ,, \t).
 */
export function detectDelimiter(csvContent: string): string {
  const firstLines = csvContent.split(/\r?\n/).slice(0, 5).join('\n');
  const counts = {
    ';': (firstLines.match(/;/g) || []).length,
    ',': (firstLines.match(/,/g) || []).length,
    '\t': (firstLines.match(/\t/g) || []).length,
  };

  if (counts[';'] >= counts[','] && counts[';'] >= counts['\t'] && counts[';'] > 0) {
    return ';';
  }
  if (counts['\t'] >= counts[','] && counts['\t'] > 0) {
    return '\t';
  }
  return ',';
}

/**
 * Zerlegt eine CSV-Zeile unter Berücksichtigung von Anführungszeichen.
 */
function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++; // Escaped quote überspringen
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

/**
 * Analysiert den rohen CSV-Text und schlägt automatisch eine Spaltenzuordnung vor.
 */
export function parseRawCsv(csvContent: string): CsvParseResult {
  const delimiter = detectDelimiter(csvContent);
  const lines = csvContent
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error('Die CSV-Datei ist leer.');
  }

  const rawHeaders = parseCsvLine(lines[0], delimiter);
  // BOM und Whitespaces bereinigen
  const headers = rawHeaders.map((h) => h.replace(/^\uFEFF/, '').trim());

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length <= 1 && values[0] === '') continue;

    const row: Record<string, string> = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] || '';
    });
    rows.push(row);
  }

  const suggestedMapping = guessColumnMapping(headers);

  return {
    headers,
    rows,
    delimiter,
    suggestedMapping,
  };
}

/**
 * Schlägt anhand gängiger deutscher und englischer Bankbegriffe eine Spaltenzuordnung vor.
 */
export function guessColumnMapping(headers: string[]): CsvColumnMapping {
  const findHeader = (patterns: RegExp[]): string => {
    for (const pattern of patterns) {
      const match = headers.find((h) => pattern.test(h));
      if (match) return match;
    }
    return '';
  };

  return {
    dateColumn:
      findHeader([
        /valuta/i,
        /wertstellung/i,
        /wertst/i,
        /datum/i,
        /date/i,
        /buchungstag/i,
        /buchungsdatum/i,
        /booking/i,
        /tag/i,
      ]) ||
      headers[0] ||
      '',
    valueDateColumn:
      findHeader([
        /valuta/i,
        /wertstellung/i,
        /wertst/i,
        /datum/i,
        /date/i,
        /buchungstag/i,
        /buchungsdatum/i,
        /booking/i,
        /tag/i,
      ]) ||
      headers[0] ||
      '',
    bookingDateColumn: findHeader([/buchungstag/i, /buchungsdatum/i, /booking/i, /datum/i]),
    issuerColumn: findHeader([
      /auftraggeber/i,
      /zahlungspflichtiger/i,
      /absender/i,
      /sender/i,
      /von/i,
    ]),
    receiverColumn: findHeader([
      /empf[aä]nger/i,
      /beg[uü]nstigter/i,
      /zahlungsdienstleister/i,
      /payee/i,
      /an/i,
      /partner/i,
    ]),
    subjectColumn:
      findHeader([
        /verwendungszweck/i,
        /buchungstext/i,
        /beschreibung/i,
        /vorgang/i,
        /subject/i,
        /memo/i,
        /details/i,
        /text/i,
        /umsatztext/i,
        /info/i,
        /zweck/i,
      ]) || (headers.length > 1 ? headers[1] : headers[0] || ''),
    valueColumn:
      findHeader([
        /betrag/i,
        /amount/i,
        /umsatz/i,
        /wert/i,
        /saldo/i,
        /soll/i,
        /haben/i,
        /preis/i,
        /summe/i,
      ]) || (headers.length > 2 ? headers[2] : headers[0] || ''),
    ibanColumn: findHeader([
      /iban.?zahlungsbeteiligter/i,
      /gegenkonto/i,
      /empf[aä]nger.?iban/i,
      /partner.?iban/i,
      /iban/i,
      /kontonummer/i,
      /konto/i,
    ]),
    accountIbanColumn: findHeader([
      /auftragskonto/i,
      /eigene.?iban/i,
      /absender.?iban/i,
      /iban.?auftragskonto/i,
    ]),
    typeColumn: findHeader([/typ/i, /art/i, /type/i, /buchungsart/i]),
  };
}

/**
 * Wandelt einen Geldbetrag aus verschiedenen Bank- und Exportformaten in eine Zahl um.
 * Unterstützt deutsche und internationale Formate, Tausendertrennzeichen (Punkte, Kommas,
 * Apostrophe, Leerzeichen), Dezimalstellen sowie vor- und nachgestellte Vorzeichen
 * oder Soll/Haben-Kennzeichnungen (S/H, DB/CR).
 *
 * @param {string} raw - Der rohe Währungs- oder Betragsstring (z. B. '2.500', '1.250,50 €', '-45,99', '2,500.00')
 * @returns {number} Der geparste numerische Betrag kaufmännisch auf 2 Nachkommastellen gerundet
 *
 * @example
 * parseCurrencyValue('2.500') // 2500
 * parseCurrencyValue('1.250,50 €') // 1250.5
 * parseCurrencyValue('-45,99') // -45.99
 * parseCurrencyValue('2.500,00-') // -2500
 * parseCurrencyValue('2.500 S') // -2500
 * parseCurrencyValue('2,500.00') // 2500
 * parseCurrencyValue('2 500,00') // 2500
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
      // Europäisches Format: 1.234.567,89 oder 2.500,50
      // Punkte als Tausendertrenner entfernen, Komma zu Dezimalpunkt
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // US/UK Format: 1,234,567.89 oder 2,500.50
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

/**
 * Erzeugt einen deterministischen Hash/ID für eine Transaktion zur Duplikatsvermeidung.
 */
export function generateTransactionId(
  accountIban: string,
  date: string,
  value: number,
  subject: string,
  iban: string,
  issuer: string,
  receiver: string
): string {
  const rawKey = `${accountIban}|${date}|${value.toFixed(2)}|${subject.trim()}|${iban.trim()}|${issuer.trim()}|${receiver.trim()}`;
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = (hash << 5) - hash + rawKey.charCodeAt(i);
    hash |= 0;
  }
  return `tx-${Math.abs(hash).toString(36)}`;
}

/**
 * Berechnet einen deterministischen, tagesgenauen Fingerabdruck (FNV-1a 32-Bit Hash)
 * für eine importierte Bank-Rohbuchung basierend auf dem Wertstellungsdatum.
 *
 * @param {string} accountIban - Bankkonto-IBAN (oder Konto-Identifikator)
 * @param {string} date - Wertstellungsdatum / Valutadatum (YYYY-MM-DD)
 * @param {number} value - Exakter Betrag
 * @param {string} subject - Verwendungszweck der Bank
 * @param {string} [partner=''] - Zahlungspartner (Empfänger oder Auftraggeber)
 * @param {string} [iban=''] - Gegenkonto-IBAN
 * @param {number} [occurrenceIndex=0] - Zähler für Mehrfachbuchungen am exakt selben Tag
 * @returns {string} Einzigartiger Fingerprint-String mit Präfix 'fp-'
 */
export function computeRawFingerprint(
  accountIban: string,
  date: string,
  value: number,
  subject: string,
  partner: string = '',
  iban: string = '',
  occurrenceIndex: number = 0
): string {
  const normSubject = (subject || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normPartner = (partner || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normIban = (iban || '').trim().toUpperCase().replace(/\s+/g, '');
  const rawKey = `${accountIban}|${date}|${value.toFixed(2)}|${normSubject}|${normPartner}|${normIban}|${occurrenceIndex}`;

  let hash = 2166136261;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(36)}`;
}

/**
 * Konvertiert die geparsten CSV-Zeilen anhand des Mappings in typisierte `Transaction`-Objekte.
 *
 * @param {Record<string, string>[]} rows - Geparste CSV-Zeilen
 * @param {CsvColumnMapping} mapping - Spaltenzuordnung
 * @param {string} [accountIban=''] - Optionale Standard-Konto-IBAN (falls in den Zeilen keine Auftragskonto-Spalte vorhanden ist)
 * @param {string} [filename] - Optionaler Dateiname der Import-CSV
 * @param {string} [importedAt] - Optionaler Zeitstempel des Imports
 * @returns {Transaction[]} Typisierte Transaktionsobjekte mit importIndex
 */
export function convertRowsToTransactions(
  rows: Record<string, string>[],
  mapping: CsvColumnMapping,
  accountIban: string = '',
  filename?: string,
  importedAt?: string
): Transaction[] {
  const timestamp = importedAt || new Date().toISOString();
  const dayOccurrences = new Map<string, number>();
  const dayIndices = new Map<string, number>();
  const fallbackAccountIban = (accountIban || '').trim().toUpperCase().replace(/\s+/g, '');

  return rows.map((row, index) => {
    const rawValDate =
      (mapping.dateColumn ? row[mapping.dateColumn] : row[mapping.valueDateColumn || '']) || '';
    const date: ISODateString = toISODateString(rawValDate);

    const rawValue = row[mapping.valueColumn] || '0';
    let value = parseCurrencyValue(rawValue);

    // Falls eine Typ-Spalte (z. B. "Soll/Haben", "Buchungsart") gewählt ist und der Betrag positiv ist,
    // prüfen ob es sich um eine Belastung / Soll-Buchung handelt
    if (mapping.typeColumn && row[mapping.typeColumn]) {
      const rawType = row[mapping.typeColumn].trim().toLowerCase();
      const isDebit =
        rawType === 's' ||
        rawType === 'soll' ||
        rawType === 'debit' ||
        rawType === 'lastschrift' ||
        rawType === 'belastung' ||
        rawType === 'ausgabe' ||
        rawType === 'abgang';
      if (isDebit && value > 0) {
        value = -value;
      }
    }

    const rowAccountIban =
      mapping.accountIbanColumn && row[mapping.accountIbanColumn]
        ? normalizeIban(row[mapping.accountIbanColumn])
        : '';
    const normAccountIban = rowAccountIban || fallbackAccountIban;

    const issuer = mapping.issuerColumn ? (row[mapping.issuerColumn] || '').trim() : '';
    const receiver = mapping.receiverColumn ? (row[mapping.receiverColumn] || '').trim() : '';
    const subject = (row[mapping.subjectColumn] || '').trim();
    const rawIban = mapping.ibanColumn ? (row[mapping.ibanColumn] || '').trim() : '';
    // Falls die erkannte ibanColumn dieselbe Spalte wie accountIbanColumn ist,
    // soll die Gegenkonto-IBAN nicht das eigene Konto sein
    const iban =
      mapping.accountIbanColumn && mapping.accountIbanColumn === mapping.ibanColumn ? '' : rawIban;

    // Tag-gebundener Occurrence-Zähler
    const partner = receiver || issuer;
    const normSubject = subject.trim().toLowerCase().replace(/\s+/g, ' ');
    const normPartner = partner.trim().toLowerCase().replace(/\s+/g, ' ');
    const normIban = iban.trim().toUpperCase().replace(/\s+/g, '');
    const dayKey = `${normAccountIban}|${date}|${value.toFixed(2)}|${normSubject}|${normPartner}|${normIban}`;

    const occurrenceIndex = dayOccurrences.get(dayKey) || 0;
    dayOccurrences.set(dayKey, occurrenceIndex + 1);

    const rawFingerprint = computeRawFingerprint(
      normAccountIban,
      date,
      value,
      subject,
      partner,
      iban,
      occurrenceIndex
    );

    // Tagesbezogener Index für dieses Datum & Konto (für stabile, tagesgebundene Sortierung)
    const dateAccountKey = `${normAccountIban}|${date}`;
    const dayIndex = dayIndices.get(dateAccountKey) || 0;
    dayIndices.set(dateAccountKey, dayIndex + 1);

    const baseId = generateTransactionId(
      normAccountIban,
      date,
      value,
      subject,
      iban,
      issuer,
      receiver
    );

    const id = `${baseId}-${index}`;

    return {
      id,
      accountIban: normAccountIban,
      date,
      valueDate: date,
      bookingDate: date,
      issuer,
      receiver,
      subject,
      get type() {
        return getTransactionType(value);
      },
      iban,
      value,
      categoryId: null,
      bucketId: null,
      assignmentSource: 'unassigned',
      origin: 'imported',
      rawFingerprint,
      importFilename: filename || undefined,
      dayIndex,
      importIndex: index,
      importedAt: timestamp,

      // Flache Original-Rohdaten aus der Bank-CSV
      originalAccountIban: normAccountIban,
      originalDate: date,
      originalValueDate: date,
      originalBookingDate: date,
      originalValue: value,
      originalSubject: subject,
      originalReceiver: receiver,
      originalIssuer: issuer,
      originalIban: iban,
    };
  });
}
