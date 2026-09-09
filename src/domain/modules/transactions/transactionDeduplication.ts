/**
 * @file transactionDeduplication.ts
 * @description Reine Domänen-Logik für semantische Transaktions-Deduplizierung,
 * Gegenbuchungserkennung bei bankübergreifenden Imports und sicheres Mergen von Transaktionen.
 * Schützt bestehende Zuweisungen, Kategorien und Overrides.
 * @module domain/modules/transactions/transactionDeduplication
 */

import { Account, Transaction } from '@/types';
import { normalizeIban } from '../accounts/accountService';

export type TransactionMatchType = 'exact' | 'counterpart' | 'same_transfer';

export interface TransactionMatchResult {
  matchedTx: Transaction;
  matchType: TransactionMatchType;
}

/**
 * Bereinigt einen Textstring (Kleinschreibung, Whitespace-Normalisierung).
 */
function normalizeText(text?: string): string {
  return (text || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Prüft, ob zwei Texte substanziell übereinstimmen (identisch oder einer enthält den anderen).
 */
function isTextSimilar(a?: string, b?: string): boolean {
  const normA = normalizeText(a);
  const normB = normalizeText(b);
  if (!normA || !normB) return false;
  if (normA === normB) return true;
  // Teil-Übereinstimmung (z. B. "Elternzeit Ausgleichsbudget" vs "Elternzeit Ausgleichsbudget Überweisung")
  if (normA.length >= 6 && normB.length >= 6) {
    if (normA.includes(normB) || normB.includes(normA)) return true;
  }
  return false;
}

/**
 * Ermittelt den absoluten Geldbetrag einer Buchung.
 */
function getAbsoluteAmount(tx: Transaction): number {
  if (tx.amount !== undefined && tx.amount > 0) {
    return tx.amount;
  }
  return Math.abs(tx.value);
}

/**
 * Prüft, ob zwei Buchungen betraglich übereinstimmen (kaufmännische Cent-Genauigkeit).
 */
function isAmountMatching(a: Transaction, b: Transaction): boolean {
  const amtA = getAbsoluteAmount(a);
  const amtB = getAbsoluteAmount(b);
  return Math.abs(amtA - amtB) < 0.005;
}

/**
 * Berechnet die absolute Tagesdifferenz zwischen zwei ISO-Datumsangaben.
 */
function getDateDiffDays(dateA: string, dateB: string): number {
  const timeA = new Date(dateA).getTime();
  const timeB = new Date(dateB).getTime();
  if (isNaN(timeA) || isNaN(timeB)) return Infinity;
  return Math.abs(timeA - timeB) / (24 * 3600 * 1000);
}

/**
 * Sucht in einer Kandidatenliste nach einer passenden bestehenden Transaktion (Duplikat oder Gegenbuchung).
 *
 * @param {Transaction} incoming - Die neu zu importierende bzw. zu prüfende Transaktion
 * @param {Transaction[]} candidates - Liste bereits vorhandener Transaktionen
 * @param {Account[]} accounts - Registrierte Konten zur Umbuchungserkennung
 * @param {Set<string>} [matchedIds] - Bereits zugeordnete IDs (verhindert Doppelbenutzung bei Mehrfachbuchungen)
 * @returns {TransactionMatchResult | null} Das gefundene Gegenstück inkl. Match-Typ oder null
 */
export function findMatchingTransaction(
  incoming: Transaction,
  candidates: Transaction[],
  accounts: Account[] = [],
  matchedIds: Set<string> = new Set()
): TransactionMatchResult | null {
  const incomingNormSender = normalizeIban(incoming.senderIban);
  const incomingNormReceiver = normalizeIban(incoming.receiverIban);
  const incomingSubject = incoming.subject || '';
  const incomingPartner = incoming.receiver || incoming.issuer || incoming.sender || '';

  // 1. Exakter Match (ID oder rawFingerprint)
  for (const cand of candidates) {
    if (cand.id === incoming.id && !matchedIds.has(cand.id)) {
      return { matchedTx: cand, matchType: 'exact' };
    }
    if (
      cand.rawFingerprint &&
      incoming.rawFingerprint &&
      cand.rawFingerprint === incoming.rawFingerprint &&
      !matchedIds.has(cand.id)
    ) {
      return { matchedTx: cand, matchType: 'exact' };
    }
  }

  // 2. Semantischer Match (Betrag identisch, Valuta-Toleranz bis 4 Tage)
  for (const cand of candidates) {
    if (matchedIds.has(cand.id)) continue;
    if (!isAmountMatching(cand, incoming)) continue;

    const diffDays = getDateDiffDays(cand.date, incoming.date);
    if (diffDays > 4) continue;

    const candNormSender = normalizeIban(cand.senderIban);
    const candNormReceiver = normalizeIban(cand.receiverIban);
    const candSubject = cand.subject || '';
    const candPartner = cand.receiver || cand.issuer || cand.sender || '';

    // --- SUB-FALL A: Gleicher gerichteter Transfer (Same Directed Flow) ---
    // Beide Seiten haben bereits Absender- und Empfänger-IBAN
    if (
      candNormSender &&
      incomingNormSender &&
      candNormReceiver &&
      incomingNormReceiver &&
      candNormSender === incomingNormSender &&
      candNormReceiver === incomingNormReceiver
    ) {
      return { matchedTx: cand, matchType: 'same_transfer' };
    }

    // --- SUB-FALL B: Gegenstück einer internen Umbuchung (Counterpart) ---
    // Eine Buchung ist Ausgang (value < 0), die andere Eingang (value > 0)
    const isOppositeSigns =
      (cand.value < 0 && incoming.value > 0) || (cand.value > 0 && incoming.value < 0);

    if (isOppositeSigns) {
      // B.1: IBAN-Kreuzübereinstimmung
      const crossIbanMatch =
        (candNormSender && incomingNormReceiver && candNormSender === incomingNormReceiver) ||
        (candNormReceiver && incomingNormSender && candNormReceiver === incomingNormSender) ||
        (candNormSender &&
          incomingNormSender &&
          candNormReceiver &&
          incomingNormReceiver &&
          candNormSender === incomingNormSender &&
          candNormReceiver === incomingNormReceiver);

      if (crossIbanMatch) {
        return { matchedTx: cand, matchType: 'counterpart' };
      }

      // B.2: Text- und Kontonamen-Kreuzabgleich (z. B. wenn Bank-CSV Gegen-IBAN nicht exportierte)
      const candPrimaryAcc = accounts.find(
        (a) =>
          (a.iban && normalizeIban(a.iban) === candNormSender) ||
          (a.iban && normalizeIban(a.iban) === candNormReceiver)
      );
      const incomingPrimaryAcc = accounts.find(
        (a) =>
          (a.iban && normalizeIban(a.iban) === incomingNormSender) ||
          (a.iban && normalizeIban(a.iban) === incomingNormReceiver)
      );

      const matchesPartnerNames =
        (candPrimaryAcc && isTextSimilar(candPrimaryAcc.name, incomingPartner)) ||
        (incomingPrimaryAcc && isTextSimilar(incomingPrimaryAcc.name, candPartner));

      const matchesSubject = isTextSimilar(candSubject, incomingSubject);
      const matchesPartner = isTextSimilar(candPartner, incomingPartner);

      if (matchesPartnerNames || (matchesSubject && matchesPartner && diffDays <= 1)) {
        return { matchedTx: cand, matchType: 'counterpart' };
      }
    }

    // --- SUB-FALL C: Gleicher Transfer mit unvollständigen Metadaten / Re-Import ---
    // Beide Buchungen haben gleiches Vorzeichen (z. B. beide -2.500 € auf Rücklagenkonto)
    const isSameSign =
      (cand.value <= 0 && incoming.value <= 0) || (cand.value >= 0 && incoming.value >= 0);
    if (isSameSign) {
      // Gleiches Hauptkonto (oder gleicher Absender)
      const isSameAccount =
        (candNormSender && incomingNormSender && candNormSender === incomingNormSender) ||
        (candNormReceiver && incomingNormReceiver && candNormReceiver === incomingNormReceiver);

      if (isSameAccount) {
        const matchesSubject = isTextSimilar(candSubject, incomingSubject);
        const matchesPartner = isTextSimilar(candPartner, incomingPartner);

        // Am gleichen Tag (oder innerhalb 1 Tages) mit identischem Betreff UND Partner
        // Verhindert, dass separate Buchungen desselben Betrags (z. B. zwei verschiedene Einkäufe oder Lastschriften)
        // fälschlicherweise als Duplikat zusammengeführt werden.
        if (matchesSubject && matchesPartner && diffDays <= 1) {
          return { matchedTx: cand, matchType: 'same_transfer' };
        }
      }
    }
  }

  return null;
}

/**
 * Führt zwei übereinstimmende Transaktionen zusammen (Merged-Datensatz).
 * - Schützt strikt bestehende Kategorisierungen (`categoryId`, `assignmentSource`)
 * - Schützt Overrides und Split-Zuweisungen
 * - Reichert fehlende IBANs und Partnerdaten an
 *
 * @param {Transaction} existing - Die bereits existierende Transaktion
 * @param {Transaction} incoming - Die neu importierte Transaktion mit ggf. ergänzenden Metadaten
 * @returns {Transaction} Die angereicherte, konsolidierte Transaktion
 */
export function mergeTransactions(existing: Transaction, incoming: Transaction): Transaction {
  // 1. Kategorienschutz: Bestehende Kategorie NIEMALS durch neue Zuweisung überschreiben
  let categoryId = existing.categoryId;
  let assignmentSource = existing.assignmentSource;
  if (!categoryId && incoming.categoryId) {
    categoryId = incoming.categoryId;
    assignmentSource = incoming.assignmentSource;
  }

  // 2. Overrides & Split-Status schützen
  const origin =
    existing.origin === 'override' || existing.splitFromId
      ? existing.origin
      : incoming.origin || existing.origin;

  // 3. IBAN-Metadaten anreichern
  const senderIban = existing.senderIban || incoming.senderIban;
  const receiverIban = existing.receiverIban || incoming.receiverIban;

  // 4. Namen und Verwendungszweck anreichern
  const sender = existing.sender || incoming.sender;
  const receiver = existing.receiver || incoming.receiver;
  const issuer = existing.issuer || incoming.issuer;

  // Ausführlicheren Verwendungszweck bevorzugen
  const subject =
    (existing.subject || '').length >= (incoming.subject || '').length
      ? existing.subject
      : incoming.subject;

  const amount = existing.amount || incoming.amount || Math.abs(existing.value);

  return {
    ...existing,
    categoryId,
    assignmentSource,
    origin,
    senderIban,
    receiverIban,
    sender,
    receiver,
    issuer,
    subject,
    amount,
    dayIndex: existing.dayIndex ?? incoming.dayIndex,
  };
}
