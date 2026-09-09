/**
 * @file accountService.ts
 * @description Reine Domänen-Logik und Berechnungen für Konten und Kontostände (Schicht 3).
 * Hängt ausschließlich von types/ ab.
 * @module domain/modules/accounts/accountService
 */

import { Account, Transaction } from '@/types';

/**
 * Normalisiert eine IBAN durch Entfernen von Leerzeichen und Konvertierung in Großbuchstaben.
 *
 * @param {string} [iban] - Zu normalisierende IBAN
 * @returns {string} Bereinigte IBAN (z. B. 'DE89370400440532013000')
 */
export function normalizeIban(iban?: string): string {
  if (!iban) return '';
  return iban.replace(/\s+/g, '').toUpperCase();
}

export interface TransactionAccountInfo {
  senderAccountId?: string;
  receiverAccountId?: string;
  includedAccountIds: string[];
}

/**
 * Liefert alle Unterkonto-IDs eines Kontos (für echte Konten die IDs ihrer virtuellen Unterkonten).
 *
 * @param {Account} account - Das übergeordnete Konto
 * @param {Account[]} accounts - Alle Konten
 * @returns {string[]} Liste der Unterkonto-IDs
 */
export function getSubAccountIds(account: Account, accounts: Account[]): string[] {
  return accounts.filter((a) => a.parentAccountId === account.id).map((a) => a.id);
}

/**
 * Löst für eine IBAN oder Konto-ID und eine optionale Kategorie das tiefste Konto in der Hierarchie auf.
 * Wenn z. B. auf ein reales Konto referenziert wird, dieses aber ein virtuelles Unterkonto
 * mit der passenden categoryId besitzt, wird das virtuelle Unterkonto zurückgegeben.
 *
 * @param {string | undefined} ibanOrId - IBAN oder ID des Kontos
 * @param {string | null | undefined} categoryId - Optionale Kategorie-ID der Buchung
 * @param {Account[]} accounts - Alle bekannten Konten
 * @param {string} [nameHint] - Optionaler Kontoname als Fallback
 * @returns {Account | undefined} Das tiefste passende Konto
 */
export function resolveDeepestAccount(
  ibanOrId: string | undefined,
  categoryId: string | null | undefined,
  accounts: Account[],
  nameHint?: string
): Account | undefined {
  const normIban = normalizeIban(ibanOrId);

  // 1. Suche nach Konto anhand IBAN oder ID
  let matchedAcc: Account | undefined;
  if (normIban || ibanOrId) {
    matchedAcc = accounts.find((a) =>
      Boolean((normIban && a.iban && normalizeIban(a.iban) === normIban) || a.id === ibanOrId)
    );
  }

  // Fallback über Kontoname, falls keine IBAN/ID übereinstimmte
  if (!matchedAcc && nameHint && nameHint.trim()) {
    const normName = nameHint.trim().toLowerCase();
    matchedAcc = accounts.find((a) => a.name.trim().toLowerCase() === normName);
  }

  if (!matchedAcc) {
    return undefined;
  }

  // 2. Wenn das gefundene Konto bereits ein virtuelles Unterkonto ist, ist es bereits das tiefste
  if (matchedAcc.accountType === 'virtual') {
    return matchedAcc;
  }

  // 3. Wenn es ein reales Hauptkonto ist und die Buchung eine Kategorie hat:
  // Prüfen, ob unter diesem Hauptkonto ein virtuelles Unterkonto für diese Kategorie existiert
  if (categoryId) {
    const matchingVirtualChild = accounts.find(
      (a) =>
        a.accountType === 'virtual' &&
        a.parentAccountId === matchedAcc!.id &&
        Boolean(a.categoryIds && a.categoryIds.includes(categoryId))
    );
    if (matchingVirtualChild) {
      return matchingVirtualChild;
    }
  }

  return matchedAcc;
}

/**
 * Ermittelt alle Konten, die einer Transaktion zugeordnet sind.
 * Liefert stets die tiefsten Konto-IDs (z. B. virtuelle Unterkonten anstelle der Elternkonten).
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account[]} accounts - Alle Konten
 * @returns {TransactionAccountInfo}
 */
export function getTransactionAccountInfo(
  tx: Transaction,
  accounts: Account[]
): TransactionAccountInfo {
  const txCatId = tx.categoryId ?? null;

  // 1. Deepest Account für Sender ermitteln
  let senderAcc = resolveDeepestAccount(tx.senderIban, txCatId, accounts, tx.sender || tx.issuer);

  // 2. Deepest Account für Receiver ermitteln
  let receiverAcc = resolveDeepestAccount(tx.receiverIban, txCatId, accounts, tx.receiver);

  // Gegenkonto-Erkennung bei internen Umbuchungen über den Namen, falls eine IBAN fehlte
  if (!receiverAcc && senderAcc && tx.receiver) {
    const normPartner = tx.receiver.trim().toLowerCase();
    const candidate = accounts.find(
      (a) =>
        a.id !== senderAcc!.id &&
        a.id !== (senderAcc!.parentAccountId || '') &&
        a.name.trim().toLowerCase() === normPartner
    );
    if (candidate) {
      receiverAcc = resolveDeepestAccount(candidate.id, txCatId, accounts);
    }
  }

  if (!senderAcc && receiverAcc && (tx.issuer || tx.sender)) {
    const normPartner = (tx.issuer || tx.sender || '').trim().toLowerCase();
    const candidate = accounts.find(
      (a) =>
        a.id !== receiverAcc!.id &&
        a.id !== (receiverAcc!.parentAccountId || '') &&
        a.name.trim().toLowerCase() === normPartner
    );
    if (candidate) {
      senderAcc = resolveDeepestAccount(candidate.id, txCatId, accounts);
    }
  }

  const includedIds = new Set<string>();
  if (senderAcc) includedIds.add(senderAcc.id);
  if (receiverAcc) includedIds.add(receiverAcc.id);

  return {
    senderAccountId: senderAcc?.id,
    receiverAccountId: receiverAcc?.id,
    includedAccountIds: Array.from(includedIds),
  };
}

/**
 * Prüft, ob in der Transaktionsliste bereits eine eigenständige Gegenbuchung existiert.
 * Dies verhindert Doppelzählungen, wenn für beide an einer Umbuchung beteiligten Konten
 * eigene Kontoauszüge importiert wurden.
 *
 * @param {Transaction} tx - Die Ausgangsbuchung
 * @param {Account} primaryAccount - Das primäre Buchungskonto der Ausgangsbuchung
 * @param {Account} counterAccount - Das Gegenkonto
 * @param {Transaction[]} allTransactions - Alle Transaktionen
 * @param {Account[]} accounts - Alle Konten
 * @returns {boolean} true, wenn eine eigenständige Gegenbuchung existiert
 */
export function hasDirectCounterpart(
  tx: Transaction,
  primaryAccount: Account,
  counterAccount: Account,
  allTransactions: Transaction[],
  accounts: Account[]
): boolean {
  const txTime = new Date(tx.date).getTime();
  const txAmount = tx.amount !== undefined ? tx.amount : Math.abs(tx.value);
  const normTxSender = normalizeIban(tx.senderIban);
  const normTxReceiver = normalizeIban(tx.receiverIban);

  return allTransactions.some((other) => {
    if (other.id === tx.id) return false;
    const otherAmount = other.amount !== undefined ? other.amount : Math.abs(other.value);
    if (Math.abs(otherAmount - txAmount) > 0.005) return false;

    // Datumstoleranz von bis zu 4 Tagen für bankübliche Wertstellungs-Laufzeiten
    const otherTime = new Date(other.date).getTime();
    if (!isNaN(txTime) && !isNaN(otherTime)) {
      if (Math.abs(otherTime - txTime) > 4 * 24 * 60 * 60 * 1000) return false;
    }

    const otherInfo = getTransactionAccountInfo(other, accounts);

    // Bei gerichteten Transaktionen: Absender & Empfänger identisch
    const normOtherSender = normalizeIban(other.senderIban);
    const normOtherReceiver = normalizeIban(other.receiverIban);
    if (
      normTxSender &&
      normTxReceiver &&
      normOtherSender &&
      normOtherReceiver &&
      normOtherSender === normTxSender &&
      normOtherReceiver === normTxReceiver
    ) {
      return true;
    }

    // 1. Beide Konten sind an dieser Gegenbuchung beteiligt
    const counterRelevant = [counterAccount.id, ...getSubAccountIds(counterAccount, accounts)];
    const primaryRelevant = [primaryAccount.id, ...getSubAccountIds(primaryAccount, accounts)];
    if (
      otherInfo.includedAccountIds.some((id) => counterRelevant.includes(id)) &&
      otherInfo.includedAccountIds.some((id) => primaryRelevant.includes(id))
    ) {
      return true;
    }

    // 2. IBAN-Übereinstimmung
    if (
      (primaryAccount.iban &&
        ((other.senderIban &&
          normalizeIban(other.senderIban) === normalizeIban(primaryAccount.iban)) ||
          (other.receiverIban &&
            normalizeIban(other.receiverIban) === normalizeIban(primaryAccount.iban)))) ||
      (counterAccount.iban &&
        ((tx.senderIban && normalizeIban(tx.senderIban) === normalizeIban(counterAccount.iban)) ||
          (tx.receiverIban &&
            normalizeIban(tx.receiverIban) === normalizeIban(counterAccount.iban))))
    ) {
      return true;
    }

    // 3. Verwendungszweck-Übereinstimmung bei identischem Gegenwert im Zeitfenster
    const normTxSubject = (tx.subject || '').trim().toLowerCase();
    const normOtherSubject = (other.subject || '').trim().toLowerCase();
    if (normTxSubject && normOtherSubject && normTxSubject === normOtherSubject) {
      return true;
    }

    // 4. Partner-Übereinstimmung
    const normTxPartner = (tx.receiver || tx.issuer || '').trim().toLowerCase();
    const normOtherPartner = (other.receiver || other.issuer || '').trim().toLowerCase();
    if (normTxPartner && normOtherPartner && normTxPartner === normOtherPartner) {
      return true;
    }

    return false;
  });
}

/**
 * Prüft, ob eine Transaktion eine interne Umbuchung zwischen zwei bekannten Nutzerkonten darstellt.
 *
 * @param {Transaction} tx - Die zu prüfende Transaktion
 * @param {Account[]} accounts - Alle registrierten Konten des Nutzers
 * @returns {boolean} true, falls sowohl Absender- als auch Empfängerkonto registrierte Nutzerkonten sind
 */
export function isInternalTransfer(tx: Transaction, accounts: Account[]): boolean {
  const info = getTransactionAccountInfo(tx, accounts);
  return Boolean(info.senderAccountId && info.receiverAccountId);
}

/**
 * Liefert den effektiven Transaktionspartner (Name und ggf. IBAN) abhängig von
 * der Kontoperspektive oder für die Gesamtansicht.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account} [currentAccount] - Das aktuell ausgewählte Konto (falls gefiltert)
 * @returns {{ name: string; iban?: string }} Partnerinformation
 */
export function getEffectiveTransactionPartner(
  tx: Transaction,
  currentAccount?: Account
): { name: string; iban?: string } {
  if (currentAccount) {
    const normAccIban = normalizeIban(currentAccount.iban);
    const isSender = Boolean(
      (normAccIban && tx.senderIban && normAccIban === normalizeIban(tx.senderIban)) ||
      currentAccount.id === tx.senderIban
    );

    if (isSender) {
      return {
        name: tx.receiver || tx.issuer || 'Unbekannter Empfänger',
        iban: tx.receiverIban,
      };
    } else {
      return {
        name: tx.sender || tx.issuer || 'Unbekannter Absender',
        iban: tx.senderIban,
      };
    }
  }

  // Gesamtsicht:
  if (tx.sender && tx.receiver && tx.sender !== tx.receiver) {
    return {
      name: `${tx.sender} → ${tx.receiver}`,
      iban: tx.receiverIban || tx.senderIban,
    };
  }

  const isOutflow = tx.value < 0;
  return {
    name: isOutflow
      ? tx.receiver || tx.issuer || 'Unbekannter Empfänger'
      : tx.sender || tx.issuer || tx.receiver || 'Unbekannter Absender',
    iban: isOutflow ? tx.receiverIban : tx.senderIban,
  };
}

/**
 * Ermittelt den effektiven Betrag einer Transaktion aus Sicht eines bestimmten Kontos.
 *
 * Für echte Konten:
 * - Wenn das Konto Absender (senderIban) ist: `-amount` (bzw. `-tx.value`)
 * - Wenn das Konto Empfänger (receiverIban) ist: `+amount` (bzw. `+tx.value`)
 * - Legacy-Fallback: Direkte Buchung (`tx.value`) oder Gegenkonto (`-tx.value`).
 *
 * Für virtuelle Unterkonten:
 * - Auswertung anhand zugeordneter Kategorien unter dem übergeordneten Hauptkonto.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {Account} targetAccount - Das Zielkonto
 * @param {Account[]} accounts - Alle Konten
 * @param {Transaction[]} [allTransactions] - Alle Transaktionen (zur Erkennung historischer Gegenbuchungen)
 * @returns {number | null} Effektiver Betrag oder null
 */
export function getTransactionEffectiveValueForAccount(
  tx: Transaction,
  targetAccount: Account,
  accounts: Account[],
  allTransactions?: Transaction[]
): number | null {
  const normTargetIban = normalizeIban(targetAccount.iban);
  const normSenderIban = normalizeIban(tx.senderIban);
  const normReceiverIban = normalizeIban(tx.receiverIban);
  const amount = tx.amount !== undefined ? tx.amount : Math.abs(tx.value);

  // 1. Virtuelle Unterkonten
  if (targetAccount.accountType === 'virtual') {
    const info = getTransactionAccountInfo(tx, accounts);
    if (!info.includedAccountIds.includes(targetAccount.id)) {
      return null;
    }

    const parentId = targetAccount.parentAccountId;
    if (!parentId) {
      return null;
    }

    const parentAccount = accounts.find((a) => a.id === parentId);
    const normParentIban = normalizeIban(parentAccount?.iban);

    // Prüfen, ob das Unterkonto selbst direkt als Sender oder Empfänger adressiert ist
    const isDirectVirtualSender = tx.senderIban === targetAccount.id;
    const isDirectVirtualReceiver = tx.receiverIban === targetAccount.id;

    if (isDirectVirtualSender && isDirectVirtualReceiver) {
      return 0;
    }
    if (isDirectVirtualSender) {
      return -amount;
    }
    if (isDirectVirtualReceiver) {
      return amount;
    }

    // Prüfen der Rolle des übergeordneten Hauptkontos bei gerichteter Buchung
    const isParentSender = Boolean(
      (normParentIban && normSenderIban && normParentIban === normSenderIban) ||
      parentId === tx.senderIban
    );
    const isParentReceiver = Boolean(
      (normParentIban && normReceiverIban && normParentIban === normReceiverIban) ||
      parentId === tx.receiverIban
    );

    // Gegenbuchungs-Deduplizierung bei Vorliegen von allTransactions
    if (allTransactions) {
      const txTime = new Date(tx.date).getTime();
      const hasDirectVirtualBooking = allTransactions.some((other) => {
        if (other.id === tx.id) return false;
        const otherAmount = other.amount !== undefined ? other.amount : Math.abs(other.value);
        if (Math.abs(otherAmount - amount) > 0.005) return false;

        const otherTime = new Date(other.date).getTime();
        if (!isNaN(txTime) && !isNaN(otherTime)) {
          if (Math.abs(otherTime - txTime) > 4 * 24 * 60 * 60 * 1000) return false;
        }

        const otherInfo = getTransactionAccountInfo(other, accounts);
        if (!otherInfo.includedAccountIds.includes(targetAccount.id)) return false;

        // Wenn other direkt aus dem Auszug des übergeordneten Kontos stammt (eigene Buchung), aber tx nicht -> tx unterdrücken
        if (isParentSender && other.value < 0 && tx.value > 0) {
          return true;
        }
        if (isParentReceiver && other.value > 0 && tx.value < 0) {
          return true;
        }

        // Bei gleichem Buchungskonto / Betrag: deterministischer Tie-Breaker (nach ID)
        if (
          ((isParentSender && other.value < 0 && tx.value < 0) ||
            (isParentReceiver && other.value > 0 && tx.value > 0) ||
            other.value === tx.value) &&
          other.id < tx.id
        ) {
          return true;
        }
        return false;
      });

      if (hasDirectVirtualBooking) {
        return null;
      }
    }

    if (isParentSender && isParentReceiver) {
      // Transfer innerhalb desselben echten Kontos ohne explizite Unterkonto-Adressierung
      return 0;
    }

    if (isParentSender) {
      return -amount;
    }

    if (isParentReceiver) {
      return amount;
    }

    // Fallback über info.senderAccountId / receiverAccountId
    if (info.senderAccountId === parentId) {
      return -amount;
    }

    if (info.receiverAccountId === parentId) {
      return amount;
    }

    return tx.value;
  }

  // 2. Echtes Konto mit expliziter gerichteter Absender- oder Empfänger-IBAN
  const isSender = Boolean(
    (normTargetIban && normSenderIban && normTargetIban === normSenderIban) ||
    targetAccount.id === tx.senderIban
  );
  const isReceiver = Boolean(
    (normTargetIban && normReceiverIban && normTargetIban === normReceiverIban) ||
    targetAccount.id === tx.receiverIban
  );

  if (isSender && isReceiver) {
    // Umbuchung auf dasselbe Konto (Netto 0)
    return 0;
  }

  // Gegenbuchungs-Deduplizierung bei Vorliegen beider Gegenstücke in allTransactions
  if (allTransactions && (isSender || isReceiver)) {
    const isInternal = accounts.some(
      (a) =>
        a.accountType !== 'virtual' &&
        a.id !== targetAccount.id &&
        ((isSender &&
          Boolean(
            (a.iban && normalizeIban(a.iban) === normReceiverIban) || a.id === tx.receiverIban
          )) ||
          (isReceiver &&
            Boolean(
              (a.iban && normalizeIban(a.iban) === normSenderIban) || a.id === tx.senderIban
            )))
    );

    if (isInternal) {
      const txTime = new Date(tx.date).getTime();
      const hasDirectStatementBooking = allTransactions.some((other) => {
        if (other.id === tx.id) return false;
        const otherAmount = other.amount !== undefined ? other.amount : Math.abs(other.value);
        if (Math.abs(otherAmount - amount) > 0.005) return false;

        const otherTime = new Date(other.date).getTime();
        if (!isNaN(txTime) && !isNaN(otherTime)) {
          if (Math.abs(otherTime - txTime) > 4 * 24 * 60 * 60 * 1000) return false;
        }

        const otherSenderIban = normalizeIban(other.senderIban);
        const otherReceiverIban = normalizeIban(other.receiverIban);

        const isSameTransfer =
          normSenderIban &&
          normReceiverIban &&
          otherSenderIban === normSenderIban &&
          otherReceiverIban === normReceiverIban;

        if (!isSameTransfer) return false;

        // Wenn other direkt aus dem Auszug von targetAccount stammt (eigene Buchung), aber tx nicht -> tx unterdrücken
        if (isSender && other.value < 0 && tx.value > 0) {
          return true;
        }
        if (isReceiver && other.value > 0 && tx.value < 0) {
          return true;
        }

        // Deterministischer Tie-Breaker (nach ID) wenn beide aus gleichem Typ oder gleichem Vorzeichen stammen
        if (
          ((isSender && other.value < 0 && tx.value < 0) ||
            (isReceiver && other.value > 0 && tx.value > 0) ||
            other.value === tx.value) &&
          other.id < tx.id
        ) {
          return true;
        }
        return false;
      });

      if (hasDirectStatementBooking) {
        return null;
      }
    }
  }

  if (isSender) {
    return -amount;
  }

  if (isReceiver) {
    return amount;
  }

  // 3. Fallback über getTransactionAccountInfo
  const info = getTransactionAccountInfo(tx, accounts);

  if (info.senderAccountId === targetAccount.id) {
    return -amount;
  }
  if (info.receiverAccountId === targetAccount.id) {
    return amount;
  }

  // 4. Echtes Hauptkonto mit Buchung auf einem seiner virtuellen Unterkonten
  const subIds = getSubAccountIds(targetAccount, accounts);
  if (info.includedAccountIds.some((id) => subIds.includes(id))) {
    if (info.receiverAccountId && subIds.includes(info.receiverAccountId)) {
      return amount;
    }
    if (info.senderAccountId && subIds.includes(info.senderAccountId)) {
      return -amount;
    }
    return tx.value;
  }

  return null;
}

/**
 * Prüft, ob eine Transaktion mit einem Konto-Filter übereinstimmt.
 *
 * @param {Transaction} tx - Die Transaktion
 * @param {string} accountId - Die Konto-ID oder 'all'
 * @param {Account[]} accounts - Alle Konten
 * @param {Transaction[]} [allTransactions] - Alle Transaktionen (zur Vermeidung von Gegenbuchungs-Duplikaten)
 * @returns {boolean}
 */
export function isTransactionMatchingAccount(
  tx: Transaction,
  accountId: string,
  accounts: Account[],
  allTransactions?: Transaction[]
): boolean {
  if (accountId === 'all') return true;
  const targetAcc = accounts.find((a) => a.id === accountId);
  const info = getTransactionAccountInfo(tx, accounts);

  if (!targetAcc) {
    return info.includedAccountIds.includes(accountId);
  }

  // 1. Virtuelles Unterkonto: matcht, wenn seine ID in includedAccountIds enthalten ist
  if (targetAcc.accountType === 'virtual') {
    if (info.includedAccountIds.includes(targetAcc.id)) {
      if (allTransactions) {
        return (
          getTransactionEffectiveValueForAccount(tx, targetAcc, accounts, allTransactions) !== null
        );
      }
      return true;
    }
    return false;
  }

  // 2. Echtes Hauptkonto: matcht, wenn seine eigene ID ODER die ID eines seiner Unterkonten enthalten ist
  const subIds = getSubAccountIds(targetAcc, accounts);
  const relevantIds = [targetAcc.id, ...subIds];
  const isIncluded = info.includedAccountIds.some((id) => relevantIds.includes(id));

  if (!isIncluded) return false;

  if (allTransactions) {
    return (
      getTransactionEffectiveValueForAccount(tx, targetAcc, accounts, allTransactions) !== null
    );
  }

  return true;
}
