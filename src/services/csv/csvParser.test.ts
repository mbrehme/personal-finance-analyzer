/**
 * @file csvParser.test.ts
 * @description Unit-Tests für den universellen CSV-Parser.
 * @module services/csv/csvParser.test
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
    expect(mapping.valueDateColumn).toBe('Valutadatum');
    expect(mapping.bookingDateColumn).toBe('Buchungstag');
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
        valueDateColumn: 'Buchungstag',
        receiverColumn: 'Empfänger',
        subjectColumn: 'Verwendungszweck',
        valueColumn: 'Betrag',
      },
      'acc-ing-1'
    );

    expect(transactions).toHaveLength(2);
    expect(transactions[0].accountId).toBe('acc-ing-1');
    expect(transactions[0].valueDate).toBe('2026-09-01');
    expect(transactions[0].receiver).toBe('Rewe Markt');
    expect(transactions[0].value).toBe(-45.5);
    expect(transactions[0].type).toBe('outbound');

    expect(transactions[1].valueDate).toBe('2026-09-02');
    expect(transactions[1].value).toBe(3200);
    expect(transactions[1].type).toBe('inbound');
  });
});
