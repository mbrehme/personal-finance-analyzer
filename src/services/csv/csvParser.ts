/**
 * @file csvParser.ts
 * @description Universeller CSV-Parser für Bank- und Finanzexporte mit intelligenter Trennzeichen-
 * und Spaltenerkennung sowie typsicherer Datums- und Betragskonvertierung.
 * @module services/csv/csvParser
 */

import { ISODateString, Transaction, TransactionType } from '@/types/finance';
import { toISODateString } from '@/utils/dateUtils';

export interface CsvColumnMapping {
  valueDateColumn: string;
  bookingDateColumn?: string;
  issuerColumn?: string;
  receiverColumn?: string;
  subjectColumn: string;
  valueColumn: string;
  ibanColumn?: string;
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
    valueDateColumn: findHeader([
      /valuta/i,
      /wertstellung/i,
      /buchungstag/i,
      /buchungsdatum/i,
      /datum/i,
      /date/i,
      /tag/i,
    ]) || headers[0] || '',
    bookingDateColumn: findHeader([
      /buchungstag/i,
      /buchungsdatum/i,
      /booking/i,
      /datum/i,
    ]),
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
    subjectColumn: findHeader([
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
    valueColumn: findHeader([
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
      /iban/i,
      /kontonummer/i,
      /gegenkonto/i,
      /konto/i,
    ]),
    typeColumn: findHeader([
      /typ/i,
      /art/i,
      /type/i,
      /buchungsart/i,
    ]),
  };
}

/**
 * Wandelt einen Geldbetrag aus verschiedenen Formaten ('1.234,56 €', '-50.00', '12,50') in eine Zahl um.
 */
export function parseCurrencyValue(raw: string): number {
  if (!raw) return 0;

  // Bereinigen von Währungssymbolen, Leerzeichen, etc.
  let cleaned = raw
    .replace(/[€$£\s]/g, '')
    .trim();

  // Prüfen auf deutsches Format: 1.234,56 oder -1.234,56
  if (/\d+\.\d{3},\d{2}/.test(cleaned) || /,\d{2}$/.test(cleaned)) {
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (/,\d+$/.test(cleaned) && !cleaned.includes('.')) {
    cleaned = cleaned.replace(',', '.');
  }

  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Erzeugt einen deterministischen Hash/ID für eine Transaktion zur Duplikatsvermeidung.
 */
export function generateTransactionId(
  accountId: string,
  valueDate: string,
  value: number,
  subject: string,
  iban: string,
  issuer: string,
  receiver: string
): string {
  const rawKey = `${accountId}|${valueDate}|${value.toFixed(2)}|${subject.trim()}|${iban.trim()}|${issuer.trim()}|${receiver.trim()}`;
  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = (hash << 5) - hash + rawKey.charCodeAt(i);
    hash |= 0;
  }
  return `tx-${Math.abs(hash).toString(36)}`;
}

/**
 * Konvertiert die geparsten CSV-Zeilen anhand des Mappings in typisierte `Transaction`-Objekte.
 *
 * @param {Record<string, string>[]} rows - Geparste CSV-Zeilen
 * @param {CsvColumnMapping} mapping - Spaltenzuordnung
 * @param {string} accountId - Zielkonto-ID
 * @param {string} [filename] - Optionaler Dateiname der Import-CSV
 * @param {string} [importedAt] - Optionaler Zeitstempel des Imports
 * @returns {Transaction[]} Typisierte Transaktionsobjekte mit importIndex
 */
export function convertRowsToTransactions(
  rows: Record<string, string>[],
  mapping: CsvColumnMapping,
  accountId: string,
  filename?: string,
  importedAt?: string
): Transaction[] {
  const timestamp = importedAt || new Date().toISOString();

  return rows.map((row, index) => {
    const rawValDate = row[mapping.valueDateColumn] || '';
    const rawBookDate = mapping.bookingDateColumn ? row[mapping.bookingDateColumn] : rawValDate;
    const valueDate: ISODateString = toISODateString(rawValDate);
    const bookingDate: ISODateString = rawBookDate ? toISODateString(rawBookDate) : valueDate;

    const rawValue = row[mapping.valueColumn] || '0';
    const value = parseCurrencyValue(rawValue);

    const issuer = mapping.issuerColumn ? (row[mapping.issuerColumn] || '').trim() : '';
    const receiver = mapping.receiverColumn ? (row[mapping.receiverColumn] || '').trim() : '';
    const subject = (row[mapping.subjectColumn] || '').trim();
    const iban = mapping.ibanColumn ? (row[mapping.ibanColumn] || '').trim() : '';

    const type: TransactionType = value >= 0 ? 'inbound' : 'outbound';

    const baseId = generateTransactionId(
      accountId,
      valueDate,
      value,
      subject,
      iban,
      issuer,
      receiver
    );

    const id = `${baseId}-${index}`;

    return {
      id,
      accountId,
      valueDate,
      bookingDate,
      issuer,
      receiver,
      subject,
      type,
      iban,
      value,
      bucketId: null,
      assignmentSource: 'unassigned',
      importFilename: filename || undefined,
      importIndex: index,
      importedAt: timestamp,
    };
  });
}
