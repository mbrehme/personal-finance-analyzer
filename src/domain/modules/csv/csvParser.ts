/**
 * @file csvParser.ts
 * @description Universeller CSV-Parser für Bank- und Finanzexporte mit intelligenter Trennzeichen-
 * und Spaltenerkennung sowie typsicherer Datums- und Betragskonvertierung.
 * @module domain/modules/csv/csvParser
 */

import { ISODateString, Transaction, getTransactionType, normalizeIban } from '@/types/finance';
import { toISODateString } from '@/utils/dateUtils';
import { roundToTwoDecimals, parseCurrencyValue } from '@/utils/moneyUtils';

export { parseCurrencyValue };

export interface CsvColumnMapping {
  /** Spalte für das Wertstellungsdatum (Valutadatum) */
  dateColumn: string;
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
  detectedAccountIban?: string;
  headerRowIndex?: number;
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
 * Sucht in den ersten Zeilen einer CSV-Datei nach der tatsächlichen Tabellenkopf-Zeile (Header Row).
 * Ignoriert vorgeschaltete Metadaten-Kopfzeilen (z. B. DKB-, ING- oder Sparkassen-Preamble).
 *
 * @param {string[]} lines - Nicht-leere CSV-Zeilen
 * @param {string} delimiter - Das ermittelte Trennzeichen
 * @returns {number} Der 0-basierte Index der Header-Zeile in `lines`
 */
export function findHeaderRowIndex(lines: string[], delimiter: string): number {
  const maxScanLines = Math.min(lines.length, 30);
  let bestIndex = 0;
  let maxScore = -1;

  // Patterns für typische Spalten-Schlüsselbegriffe
  const datePattern = /(datum|date|valuta|wertstellung|buchungstag|buchungsdatum|booking)/i;
  const valuePattern = /(betrag|amount|umsatz|saldo|wert|summe)/i;
  const subjectPattern =
    /(verwendungszweck|buchungstext|beschreibung|vorgang|subject|details|memo|text)/i;
  const partnerPattern =
    /(empf[aä]nger|beg[uü]nstigter|zahlungspflichtig|zahlungsempf|auftraggeber|absender|partner|payee|von|an)/i;
  const ibanPattern = /(iban|konto|kontonummer|account)/i;

  for (let i = 0; i < maxScanLines; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine) continue;

    const values = parseCsvLine(rawLine, delimiter);
    if (values.length < 2) continue;

    // Prüfen, ob die Spaltennamen wie typische Tabellenheader klingen
    let score = 0;
    if (values.some((v) => datePattern.test(v))) score += 3;
    if (values.some((v) => valuePattern.test(v))) score += 3;
    if (values.some((v) => subjectPattern.test(v))) score += 2;
    if (values.some((v) => partnerPattern.test(v))) score += 2;
    if (values.some((v) => ibanPattern.test(v))) score += 1;

    // Zeilen, die typische Datums-Werte wie "07.09.26" oder "2026-09-07" enthalten, sind Datenzeilen, keine Header!
    const containsDateValue = values.some(
      (v) =>
        /^\d{1,2}[./-]\d{1,2}[./-]\d{2,4}$/.test(v.trim()) || /^\d{4}-\d{2}-\d{2}$/.test(v.trim())
    );
    if (containsDateValue) {
      score -= 5;
    }

    // Zeilen mit vielen Spalten (echte Banktabellen haben meist >= 4 Spalten)
    if (values.length >= 4) {
      score += 1;
    }

    if (score > maxScore) {
      maxScore = score;
      bestIndex = i;
    }
  }

  // Plausibilitäts-Schwellenwert (mindestens zwei Treffer wie Datum + Betrag)
  if (maxScore >= 5) {
    return bestIndex;
  }

  return 0;
}

/**
 * Durchsucht Zeilen vor dem eigentlichen Tabellenkopf nach einer IBAN des eigenen Kontos.
 *
 * @param {string[]} lines - CSV-Zeilen
 * @param {number} headerRowIndex - Index der Header-Zeile
 * @returns {string | undefined} Gefundene IBAN oder undefined
 */
export function extractIbanFromPreamble(
  lines: string[],
  headerRowIndex: number
): string | undefined {
  const ibanRegex = /\b([A-Z]{2}\d{2}[A-Z0-9]{11,30})\b/i;
  for (let i = 0; i < headerRowIndex; i++) {
    const match = lines[i].match(ibanRegex);
    if (match) {
      return match[1].toUpperCase().replace(/\s+/g, '');
    }
  }
  return undefined;
}

/**
 * Analysiert den rohen CSV-Text und schlägt automatisch eine Spaltenzuordnung vor.
 * Erkennt und überspringt automatisch Metadaten-Header / Kopfzeilen vor der Datentabelle.
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

  const headerRowIndex = findHeaderRowIndex(lines, delimiter);
  const detectedAccountIban = extractIbanFromPreamble(lines, headerRowIndex);

  const rawHeaders = parseCsvLine(lines[headerRowIndex], delimiter);
  // BOM und Whitespaces bereinigen
  const headers = rawHeaders.map((h) => h.replace(/^\uFEFF/, '').trim());

  const rows: Record<string, string>[] = [];

  for (let i = headerRowIndex + 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i], delimiter);
    if (values.length <= 1 && values[0] === '') continue;
    // Trailer-Zeilen oder unvollständige Zeilen mit weniger als 2 gefüllten Spalten ignorieren
    if (values.filter(Boolean).length < 2) continue;

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
    detectedAccountIban,
    headerRowIndex,
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
    issuerColumn: findHeader([
      /auftraggeber/i,
      /zahlungspflichtig/i,
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
    typeColumn: findHeader([/umsatztyp/i, /typ/i, /art/i, /type/i, /buchungsart/i]),
  };
}

/**
 * Wandelt einen Geldbetrag aus verschiedenen Bank- und Exportformaten in eine Zahl um.
 * Unterstützt deutsche und internationale Formate, Tausendertrennzeichen (Punkte, Kommas,
 * Apostrophe, Leerzeichen), Dezimalstellen sowie vor- und nachgestellte Vorzeichen
 * oder Soll/Haben-Kennzeichnungen (S/H, DB/CR).
 *
 * @param {string} raw - Der rohe Währungs- oder Betragsstring (z. B. '2.500', '1.250,50 €', '-45,99', '2,500.00')


/**
 * Erzeugt einen deterministischen Hash/ID für eine Transaktion zur Duplikatsvermeidung (Legacy).
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
 * Erzeugt eine symmetrische deterministische ID für eine gerichtete Transaktion.
 * Sichert ab, dass ein Übertrag von Konto A nach Konto B sowohl im Auszug von A
 * als auch im Auszug von B dieselbe ID erzeugt.
 */
export function generateDirectedTransactionId(
  date: string,
  amount: number,
  senderIban: string = '',
  receiverIban: string = '',
  subject: string = '',
  partnerName: string = ''
): string {
  const normSubject = (subject || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normPartner = (partnerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normSenderIban = (senderIban || '').trim().toUpperCase().replace(/\s+/g, '');
  const normReceiverIban = (receiverIban || '').trim().toUpperCase().replace(/\s+/g, '');
  const rawKey = `${date}|${amount.toFixed(2)}|${normSenderIban}|${normReceiverIban}|${normSubject}|${normPartner}`;

  let hash = 0;
  for (let i = 0; i < rawKey.length; i++) {
    hash = (hash << 5) - hash + rawKey.charCodeAt(i);
    hash |= 0;
  }
  return `tx-${Math.abs(hash).toString(36)}`;
}

/**
 * Berechnet einen deterministischen, tagesgenauen Fingerabdruck (FNV-1a 32-Bit Hash)
 * für eine importierte Bank-Rohbuchung basierend auf dem Wertstellungsdatum (Legacy).
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
 * Berechnet einen symmetrischen, gerichteten Fingerabdruck für eine Transaktion.
 * Garantiert identische Fingerabdrücke unabhängig davon, welcher Kontoauszug zuerst importiert wurde.
 */
export function computeDirectedFingerprint(
  date: string,
  amount: number,
  senderIban: string = '',
  receiverIban: string = '',
  subject: string = '',
  partnerName: string = '',
  occurrenceIndex: number = 0
): string {
  const normSubject = (subject || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normPartner = (partnerName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  const normSenderIban = (senderIban || '').trim().toUpperCase().replace(/\s+/g, '');
  const normReceiverIban = (receiverIban || '').trim().toUpperCase().replace(/\s+/g, '');
  const rawKey = `${date}|${amount.toFixed(2)}|${normSenderIban}|${normReceiverIban}|${normSubject}|${normPartner}|${occurrenceIndex}`;

  let hash = 2166136261;
  for (let i = 0; i < rawKey.length; i++) {
    hash ^= rawKey.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `fp-${(hash >>> 0).toString(36)}`;
}

/**
 * Konvertiert die geparsten CSV-Zeilen anhand des Mappings in typisierte `Transaction`-Objekte
 * nach dem gerichteten Geldfluss-Modell.
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
  const fallbackAccountIban = normalizeIban(accountIban);

  const dayOccurrences = new Map<string, number>();
  const dayIndices = new Map<string, number>();

  return rows.map((row) => {
    const rawValDate = row[mapping.dateColumn] || '';
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
        rawType === 'ausgang' ||
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
    const iban =
      mapping.accountIbanColumn && mapping.accountIbanColumn === mapping.ibanColumn ? '' : rawIban;

    // --- Gerichtetes Geldfluss-Modell ---
    const isOutflow = value < 0;
    const amount = roundToTwoDecimals(Math.abs(value));

    const normPartnerIban = normalizeIban(iban);
    const senderIban = isOutflow ? normAccountIban : normPartnerIban;
    const receiverIban = isOutflow ? normPartnerIban : normAccountIban;

    const senderName = isOutflow ? issuer : issuer || receiver;
    const receiverName = isOutflow ? receiver || issuer : receiver;

    const partner = receiver || issuer;
    const normPartner = partner.trim().toLowerCase().replace(/\s+/g, ' ');
    const normSubject = subject.trim().toLowerCase().replace(/\s+/g, ' ');
    const normSenderIban = (senderIban || '').toUpperCase().replace(/\s+/g, '');
    const normReceiverIban = (receiverIban || '').toUpperCase().replace(/\s+/g, '');

    const directedDayKey = `${normSenderIban}|${normReceiverIban}|${date}|${amount.toFixed(2)}|${normSubject}|${normPartner}`;

    const occurrenceIndex = dayOccurrences.get(directedDayKey) || 0;
    dayOccurrences.set(directedDayKey, occurrenceIndex + 1);

    const rawFingerprint = computeDirectedFingerprint(
      date,
      amount,
      normSenderIban,
      normReceiverIban,
      normSubject,
      normPartner,
      occurrenceIndex
    );

    // Tagesbezogener Index für dieses Datum & Konto (für stabile, tagesgebundene Sortierung)
    const dateAccountKey = `${normAccountIban}|${date}`;
    const dayIndex = dayIndices.get(dateAccountKey) || 0;
    dayIndices.set(dateAccountKey, dayIndex + 1);

    const baseId = generateDirectedTransactionId(
      date,
      amount,
      normSenderIban,
      normReceiverIban,
      normSubject,
      normPartner
    );

    const id = occurrenceIndex > 0 ? `${baseId}-${occurrenceIndex}` : baseId;

    return {
      id,
      date,
      amount,
      senderIban: normSenderIban,
      receiverIban: normReceiverIban,
      sender: senderName,
      receiver: receiverName,
      subject,
      issuer,
      value,
      get type() {
        return getTransactionType(value);
      },

      categoryId: null,
      assignmentSource: 'unassigned',
      origin: 'imported',
      rawFingerprint,
      importFilename: filename || undefined,
      dayIndex,
      importedAt: timestamp,

      // Flache Original-Rohdaten aus der Bank-CSV
      originalDate: date,
      originalValue: value,
      originalAmount: amount,
      originalSenderIban: senderIban,
      originalReceiverIban: receiverIban,
      originalSender: senderName,
      originalSubject: subject,
      originalReceiver: receiverName,
      originalIssuer: issuer,
    };
  });
}
