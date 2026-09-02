/**
 * API Service Layer
 * Hier können spätere HTTP-/Fetch-Aufrufe an eine REST- oder GraphQL-API gebündelt werden.
 */

export interface Transaction {
  id: string;
  description: string;
  category: string;
  amount: number;
  date: string;
  type: 'income' | 'expense';
}

export interface FinancialSummary {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  savingsRate: number;
}

// Beispielhafter Basispfad für API-Aufrufe
const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://api.example.com';

/**
 * Generischer API-Client für standardisierte Fetch-Aufrufe
 */
export async function apiRequest<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;

  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers || {}),
  };

  try {
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
      throw new Error(`API Fehler: ${response.status} ${response.statusText}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`Fehler bei Anfrage an ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Service-Methoden mit Mock-Daten für die Demo / Entwicklung
 */
export const financeService = {
  // Finanzübersicht abrufen
  getSummary: async (): Promise<FinancialSummary> => {
    // Bei Backend-Anbindung: return apiRequest<FinancialSummary>('/summary');
    return {
      totalBalance: 24850.5,
      monthlyIncome: 4200.0,
      monthlyExpenses: 2650.8,
      savingsRate: 36.9,
    };
  },

  // Liste aller Transaktionen abrufen
  getTransactions: async (): Promise<Transaction[]> => {
    // Bei Backend-Anbindung: return apiRequest<Transaction[]>('/transactions');
    return [
      {
        id: 'tx-1',
        description: 'Gehaltseingang Tech Corp',
        category: 'Gehalt',
        amount: 4200.0,
        date: '2026-09-01',
        type: 'income',
      },
      {
        id: 'tx-2',
        description: 'Wohnungsmiete & Nebenkosten',
        category: 'Wohnen',
        amount: 1150.0,
        date: '2026-09-01',
        type: 'expense',
      },
      {
        id: 'tx-3',
        description: 'Supermarkt Bio-Markt',
        category: 'Lebensmittel',
        amount: 84.6,
        date: '2026-08-30',
        type: 'expense',
      },
      {
        id: 'tx-4',
        description: 'ETF Sparplan MSCI World',
        category: 'Investition',
        amount: 500.0,
        date: '2026-08-28',
        type: 'expense',
      },
      {
        id: 'tx-5',
        description: 'Internet & Mobilfunk',
        category: 'Kommunikation',
        amount: 49.99,
        date: '2026-08-25',
        type: 'expense',
      },
    ];
  },
};

