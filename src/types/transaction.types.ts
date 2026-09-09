/**
 * @file transaction.types.ts
 * @description Typdefinitionen für Transaktionen / Buchungen und Filterkriterien.
 * @module types/transaction.types
 */

import { ISODateString } from './common.types';
import { CategoryAssignmentSource } from './category.types';

/**
 * Transaktionstyp: Einnahme (Inbound) oder Ausgabe (Outbound).
 */
export type TransactionType = 'inbound' | 'outbound';

/**
 * Gerichteter Geldfluss-Typ: Einnahme, Ausgabe oder interne Umbuchung zwischen eigenen Konten.
 */
export type TransactionFlowType = 'inbound' | 'outbound' | 'transfer';

/**
 * Herkunft einer Transaktion:
 * - 'imported': Unveränderte Original-Bankbuchung
 * - 'split': Aus einer Aufteilung hervorgegangene Teilbuchung
 * - 'override': Nachträglich manuell editiert oder überschrieben
 */
export type TransactionOrigin = 'imported' | 'split' | 'override';

/**
 * Eine einzelne Finanzbuchung / Transaktion.
 * Unterstützt sowohl das gerichtete Geldfluss-Modell (sender -> receiver) als auch
 * abwärtskompatible Auszugsfelder.
 */
export interface Transaction {
  /** Eindeutige, deterministische ID (generiert aus Datum, Betrag, sender/receiver-IBAN, Text) */
  id: string;
  /** Wertstellungsdatum (Valutadatum) der Buchung */
  date: ISODateString;

  /* --- Gerichtetes Geldfluss-Modell (Directed Money Flow) --- */
  /** Vorzeichenloser Betrag der Transaktion (stets >= 0) */
  amount?: number;
  /** IBAN des absendenden Kontos (Zahlungspflichtiger) */
  senderIban?: string;
  /** Name / Bezeichnung des Absenders */
  sender?: string;
  /** IBAN des empfangenden Kontos (Zahlungsempfänger) */
  receiverIban?: string;
  /** Name / Bezeichnung des Empfängers */
  receiver: string;
  /** Verwendungszweck / Buchungstext */
  subject: string;

  /* --- Auszugsbezogene Felder --- */
  /** Auftraggeber / Absender der Zahlung (äquivalent zu sender) */
  issuer: string;
  /**
   * Virtueller Typ der Transaktion (Inbound = Einnahme bei value >= 0, Outbound = Ausgabe bei value < 0).
   * Wird nicht in der Datenbank persistiert, sondern dynamisch aus dem Vorzeichen von `value` abgeleitet.
   */
  type?: TransactionType;
  /** Betrag der Transaktion (positiv für Inbound, negativ für Outbound) */
  value: number;

  /** ID der zugeordneten Kategorie oder null */
  categoryId?: string | null;
  /**
   * Zuweisungs-Herkunft:
   * - 'auto_regex': Automatisch via Regex zugewiesen (wird bei Regex-Update neu evaluiert)
   * - 'manual': Vom Nutzer manuell gesetzt (gesperrt gegen automatisches Überschreiben)
   * - 'unassigned': Noch keiner Kategorie zugeordnet
   */
  assignmentSource: CategoryAssignmentSource;
  /** Dateiname der ursprünglichen CSV-Importdatei */
  importFilename?: string;
  /** Index der Transaktion innerhalb desselben Wertstellungstages (0, 1, 2, ...) für tagesbasierte Reihenfolge */
  dayIndex?: number;
  /** Import-Zeitpunkt als ISO-String */
  importedAt?: string;
  /**
   * Virtuelle oder persistierte Herkunft der Transaktion:
   * 'imported' (Default), 'split' (Split-Kind) oder 'override' (manuell angepasst).
   */
  origin?: TransactionOrigin;
  /** Unveränderlicher Fingerabdruck der ursprünglichen Bank-Rohdaten (nur bei importierten Buchungen) */
  rawFingerprint?: string;
  /** ID der Ursprungsbuchung, falls diese Buchung aus einem Split hervorging */
  splitFromId?: string;

  /* Flache Original-Felder der Bank-Rohdaten (nur bei importierten Buchungen vorhanden) */
  /** Ursprüngliches Wertstellungsdatum (Valutadatum) aus den Bank-Rohdaten */
  originalDate?: ISODateString;
  originalValue?: number;
  originalAmount?: number;
  originalSenderIban?: string;
  originalReceiverIban?: string;
  originalSender?: string;
  originalSubject?: string;
  originalReceiver?: string;
  originalIssuer?: string;
  /** Zeitstempel der Löschung als ISO-String (falls gelöscht / im Papierkorb) */
  deletedAt?: string;
}

/**
 * Filteroptionen für die Transaktionsansicht.
 */
export interface TransactionFilterOptions {
  accountId?: string;
  categoryId?: string | 'uncategorized' | 'assigned' | 'manual';
  type?: TransactionType | 'all';
  origin?: 'all' | 'imported' | 'split' | 'override' | 'deleted';
  startDate?: ISODateString;
  endDate?: ISODateString;
  searchTerm?: string;
  minValue?: number;
  maxValue?: number;
}
