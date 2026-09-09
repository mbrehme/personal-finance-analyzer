/**
 * @file csvParser.test.ts
 * @description Unit-Tests für den universellen CSV-Parser.
 * @module domain/modules/csv/csvParser.test
 */

import { describe, it, expect } from 'vitest';
import {
  detectDelimiter,
  parseRawCsv,
  parseCurrencyValue,
  guessColumnMapping,
  convertRowsToTransactions,
} from './csvParser';

describe('csvParser', () => {
  it('detects semicolon and comma delimiters correctly', () => {
    const csvSemicolon = 'Datum;Empfänger;Betrag\n01.09.2026;Rewe;-25,50';
    const csvComma = 'Date,Payee,Amount\n2026-09-01,Rewe,-25.50';

    expect(detectDelimiter(csvSemicolon)).toBe(';');
    expect(detectDelimiter(csvComma)).toBe(',');
  });

  it('correctly parses German currency strings with thousands separators', () => {
    expect(parseCurrencyValue('1.250,50 €')).toBe(1250.5);
    expect(parseCurrencyValue('-45,99')).toBe(-45.99);
    expect(parseCurrencyValue('3500.00')).toBe(3500);
    expect(parseCurrencyValue('')).toBe(0);
  });

  it('correctly parses numbers with digit groupers without decimals (e.g. 2.500 -> 2500)', () => {
    // Exact user bug: 2.500 was wrongly parsed as 2.5
    expect(parseCurrencyValue('2.500')).toBe(2500);
    expect(parseCurrencyValue('-2.500')).toBe(-2500);
    expect(parseCurrencyValue('+2.500')).toBe(2500);
    expect(parseCurrencyValue('2.500 €')).toBe(2500);
    expect(parseCurrencyValue('25.000')).toBe(25000);
    expect(parseCurrencyValue('100.000')).toBe(100000);
    expect(parseCurrencyValue('1.000.000')).toBe(1000000);

    // English format thousands separator
    expect(parseCurrencyValue('2,500')).toBe(2500);
    expect(parseCurrencyValue('2,500.00')).toBe(2500);
    expect(parseCurrencyValue('1,000,000')).toBe(1000000);

    // Swiss apostrophe and spaces
    expect(parseCurrencyValue("2'500")).toBe(2500);
    expect(parseCurrencyValue("2'500.00")).toBe(2500);
    expect(parseCurrencyValue('2 500,00')).toBe(2500);
    expect(parseCurrencyValue('2 500')).toBe(2500);

    // Trailing signs and accounting formats
    expect(parseCurrencyValue('2.500-')).toBe(-2500);
    expect(parseCurrencyValue('2.500,00-')).toBe(-2500);
    expect(parseCurrencyValue('2.500 S')).toBe(-2500);
    expect(parseCurrencyValue('2.500 H')).toBe(2500);
    expect(parseCurrencyValue('(2.500,00)')).toBe(-2500);

    // Regular decimals are preserved
    expect(parseCurrencyValue('12,50')).toBe(12.5);
    expect(parseCurrencyValue('12,5')).toBe(12.5);
    expect(parseCurrencyValue('12.50')).toBe(12.5);
    expect(parseCurrencyValue('12.5')).toBe(12.5);
    expect(parseCurrencyValue('0,99')).toBe(0.99);
    expect(parseCurrencyValue('0.99')).toBe(0.99);
    expect(parseCurrencyValue('0.500')).toBe(0.5);
    expect(parseCurrencyValue('0,500')).toBe(0.5);
  });

  it('guesses column mappings for typical German bank statement headers', () => {
    const headers = [
      'Buchungstag',
      'Valutadatum',
      'Auftraggeber / Begünstigter',
      'Verwendungszweck',
      'Betrag (EUR)',
      'IBAN',
    ];

    const mapping = guessColumnMapping(headers);
    expect(mapping.dateColumn).toBe('Valutadatum');
    expect(mapping.subjectColumn).toBe('Verwendungszweck');
    expect(mapping.valueColumn).toBe('Betrag (EUR)');
    expect(mapping.ibanColumn).toBe('IBAN');
  });

  it('parses raw CSV text into rows and converts into typed Transaction array', () => {
    const csv = `Buchungstag;Empfänger;Verwendungszweck;Betrag
01.09.2026;Rewe Markt;Lebensmitteleinkauf;-45,50
02.09.2026;Tech AG;Gehalt 08/2026;3.200,00`;

    const parsed = parseRawCsv(csv);
    expect(parsed.delimiter).toBe(';');
    expect(parsed.rows).toHaveLength(2);

    const transactions = convertRowsToTransactions(
      parsed.rows,
      {
        dateColumn: 'Buchungstag',
        receiverColumn: 'Empfänger',
        subjectColumn: 'Verwendungszweck',
        valueColumn: 'Betrag',
      },
      'DE11112222'
    );

    expect(transactions).toHaveLength(2);
    expect(transactions[0].senderIban).toBe('DE11112222');
    expect(transactions[0].date).toBe('2026-09-01');
    expect(transactions[0].receiver).toBe('Rewe Markt');
    expect(transactions[0].value).toBe(-45.5);
    expect(transactions[0].type).toBe('outbound');

    expect(transactions[0].origin).toBe('imported');
    expect(transactions[0].rawFingerprint).toBeDefined();
    expect(transactions[0].originalDate).toBe('2026-09-01');
    expect(transactions[0].originalValue).toBe(-45.5);
    expect(transactions[0].originalSubject).toBe('Lebensmitteleinkauf');
    expect(transactions[0].originalReceiver).toBe('Rewe Markt');
    expect(transactions[0].originalSenderIban).toBe('DE11112222');

    expect(transactions[1].date).toBe('2026-09-02');
    expect(transactions[1].value).toBe(3200);
    expect(transactions[1].type).toBe('inbound');
    expect(transactions[1].originalValue).toBe(3200);
  });

  it('computes deterministic, normalized rawFingerprint with day-isolated occurrenceIndex', async () => {
    const { computeRawFingerprint } = await import('./csvParser');

    // Case and whitespace normalization
    const fp1 = computeRawFingerprint(
      'acc-1',
      '2026-09-01',
      -25.5,
      '  REWE   MARKT ',
      ' Rewe Gmbh ',
      'DE89 3704 0044',
      0
    );
    const fp2 = computeRawFingerprint(
      'acc-1',
      '2026-09-01',
      -25.5,
      'rewe markt',
      'rewe gmbh',
      'DE8937040044',
      0
    );
    expect(fp1).toBe(fp2);

    // occurrenceIndex increments for same day
    const fpSameDay2 = computeRawFingerprint(
      'acc-1',
      '2026-09-01',
      -25.5,
      'rewe markt',
      'rewe gmbh',
      'DE8937040044',
      1
    );
    expect(fpSameDay2).not.toBe(fp1);

    // Different day produces different fingerprint even with index 0
    const fpDiffDay = computeRawFingerprint(
      'acc-1',
      '2026-09-02',
      -25.5,
      'rewe markt',
      'rewe gmbh',
      'DE8937040044',
      0
    );
    expect(fpDiffDay).not.toBe(fp1);
  });

  it('assigns dayIndex sequentially per date and account', () => {
    const csv = `Buchungstag;Empfänger;Verwendungszweck;Betrag
01.09.2026;Rewe Markt;Einkauf 1;-10,00
01.09.2026;Bäcker;Einkauf 2;-5,00
01.09.2026;Apotheke;Einkauf 3;-15,00
02.09.2026;Tanken;Sprit;-70,00
02.09.2026;Supermarkt;Einkauf 4;-25,00`;

    const parsed = parseRawCsv(csv);
    const transactions = convertRowsToTransactions(
      parsed.rows,
      {
        dateColumn: 'Buchungstag',
        receiverColumn: 'Empfänger',
        subjectColumn: 'Verwendungszweck',
        valueColumn: 'Betrag',
      },
      'DE11112222'
    );

    expect(transactions).toHaveLength(5);
    // Same date (01.09.2026) -> sequential 0, 1, 2
    expect(transactions[0].date).toBe('2026-09-01');
    expect(transactions[0].dayIndex).toBe(0);
    expect(transactions[1].date).toBe('2026-09-01');
    expect(transactions[1].dayIndex).toBe(1);
    expect(transactions[2].date).toBe('2026-09-01');
    expect(transactions[2].dayIndex).toBe(2);

    // Next date (02.09.2026) -> resets to 0, 1
    expect(transactions[3].date).toBe('2026-09-02');
    expect(transactions[3].dayIndex).toBe(0);
    expect(transactions[4].date).toBe('2026-09-02');
    expect(transactions[4].dayIndex).toBe(1);
  });

  it('automatically detects and skips metadata preamble headers and extracts account IBAN (e.g. DKB format)', () => {
    const dkbCsv = `"Tagesgeld";"DE80120300001027106861"
"Zeitraum:";"01.01.2024 - 07.09.2026"
"Kontostand vom 07.09.2026:";"15.442,57 €"
""
"Buchungsdatum";"Wertstellung";"Status";"Zahlungspflichtige*r";"Zahlungsempfänger*in";"Verwendungszweck";"Umsatztyp";"IBAN";"Betrag (€)";"Gläubiger-ID";"Mandatsreferenz";"Kundenreferenz"
"07.09.26";"07.09.26";"Gebucht";"Denise Gül Brehme und Martin Brehme";"Denise Gül Brehme";"Rücklage: Urlaub";"Eingang";"DE89120300001083850147";"250";"";"";""
"01.09.26";"01.09.26";"Gebucht";"Denise Gül Brehme";"Denise Gül Brehme";"Buffer";"Ausgang";"DE89120300001083850147";"-1.000";"";"";""
"28.08.26";"28.08.26";"Gebucht";"Denise Gül Brehme";"Denise Gül Brehme";"Einschulung";"Ausgang";"DE89120300001083850147";"-1.500";"";"";""`;

    const parsed = parseRawCsv(dkbCsv);

    // 1. Erkennt Header-Zeile 4 und ignoriert Zeilen 0-3
    expect(parsed.headerRowIndex).toBe(4);
    expect(parsed.headers).toEqual([
      'Buchungsdatum',
      'Wertstellung',
      'Status',
      'Zahlungspflichtige*r',
      'Zahlungsempfänger*in',
      'Verwendungszweck',
      'Umsatztyp',
      'IBAN',
      'Betrag (€)',
      'Gläubiger-ID',
      'Mandatsreferenz',
      'Kundenreferenz',
    ]);

    // 2. Erkennt die IBAN aus der Preamble-Zeile 0
    expect(parsed.detectedAccountIban).toBe('DE80120300001027106861');

    // 3. Spaltenzuordnungen werden präzise erraten
    expect(parsed.suggestedMapping.dateColumn).toBe('Wertstellung');
    expect(parsed.suggestedMapping.issuerColumn).toBe('Zahlungspflichtige*r');
    expect(parsed.suggestedMapping.receiverColumn).toBe('Zahlungsempfänger*in');
    expect(parsed.suggestedMapping.subjectColumn).toBe('Verwendungszweck');
    expect(parsed.suggestedMapping.typeColumn).toBe('Umsatztyp');
    expect(parsed.suggestedMapping.ibanColumn).toBe('IBAN');
    expect(parsed.suggestedMapping.valueColumn).toBe('Betrag (€)');

    // 4. Zeilen werden korrekt konvertiert
    expect(parsed.rows).toHaveLength(3);

    const txs = convertRowsToTransactions(
      parsed.rows,
      parsed.suggestedMapping,
      parsed.detectedAccountIban
    );
    expect(txs).toHaveLength(3);

    // Transaktion 1 (Eingang 250 €)
    expect(txs[0].date).toBe('2026-09-07');
    expect(txs[0].receiverIban).toBe('DE80120300001027106861');
    expect(txs[0].senderIban).toBe('DE89120300001083850147');
    expect(txs[0].issuer).toBe('Denise Gül Brehme und Martin Brehme');
    expect(txs[0].receiver).toBe('Denise Gül Brehme');
    expect(txs[0].subject).toBe('Rücklage: Urlaub');
    expect(txs[0].value).toBe(250);
    expect(txs[0].type).toBe('inbound');

    // Transaktion 2 (Ausgang -1000 € mit Tausenderpunkt "-1.000")
    expect(txs[1].date).toBe('2026-09-01');
    expect(txs[1].value).toBe(-1000);
    expect(txs[1].type).toBe('outbound');

    // Transaktion 3 (Ausgang -1500 €)
    expect(txs[2].date).toBe('2026-08-28');
    expect(txs[2].value).toBe(-1500);
    expect(txs[2].type).toBe('outbound');
  });

  it('generates identical fingerprint and ID for transfer imported from both accounts (directed flow)', () => {
    const giroIban = 'DE89120300001083850147';
    const tagesgeldIban = 'DE80120300001027106861';

    // 1. Auszug von Girokonto: Ausgang 960 € an Tagesgeld
    const giroCsv = `Buchungstag;Begünstigter / Auftraggeber;IBAN;Verwendungszweck;Betrag (€)
01.03.2026;Martin Brehme;${tagesgeldIban};Sparübertrag Rücklagen;-960,00`;
    const giroParsed = parseRawCsv(giroCsv);
    const [giroTx] = convertRowsToTransactions(
      giroParsed.rows,
      giroParsed.suggestedMapping,
      giroIban
    );

    // 2. Auszug von Tagesgeld: Eingang 960 € von Girokonto
    const tgCsv = `Buchungstag;Begünstigter / Auftraggeber;IBAN;Verwendungszweck;Betrag (€)
01.03.2026;Martin Brehme;${giroIban};Sparübertrag Rücklagen;960,00`;
    const tgParsed = parseRawCsv(tgCsv);
    const [tgTx] = convertRowsToTransactions(
      tgParsed.rows,
      tgParsed.suggestedMapping,
      tagesgeldIban
    );

    // Beide müssen exakt dieselben gerichteten Eigenschaften besitzen
    expect(giroTx.amount).toBe(960);
    expect(tgTx.amount).toBe(960);
    expect(giroTx.senderIban).toBe(giroIban);
    expect(tgTx.senderIban).toBe(giroIban);
    expect(giroTx.receiverIban).toBe(tagesgeldIban);
    expect(tgTx.receiverIban).toBe(tagesgeldIban);

    // Fingerprint und deterministische ID sind 100% identisch
    expect(giroTx.rawFingerprint).toBe(tgTx.rawFingerprint);
    expect(giroTx.id).toBe(tgTx.id);
  });
});
