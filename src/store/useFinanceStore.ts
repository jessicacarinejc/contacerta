import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { accounts, assets, budgets, cards, categories, goals, transactions } from '../data/seed';
import { createId } from '../lib/ids';
import { platformStorage } from '../lib/platform-storage';
import type {
  Account,
  Asset,
  Budget,
  CreditCard,
  DocumentRecord,
  FinanceSettings,
  Goal,
  Transaction,
} from '../types/finance';

interface FinanceState {
  accounts: Account[];
  categories: typeof categories;
  transactions: Transaction[];
  cards: CreditCard[];
  budgets: Budget[];
  goals: Goal[];
  assets: Asset[];
  documents: DocumentRecord[];
  settings: FinanceSettings;
  addTransaction: (transaction: Omit<Transaction, 'id' | 'createdAt'>) => string;
  updateTransaction: (id: string, patch: Partial<Transaction>) => void;
  deleteTransaction: (id: string) => void;
  addAccount: (account: Omit<Account, 'id'>) => void;
  updateAccount: (id: string, patch: Partial<Account>) => void;
  addCard: (card: Omit<CreditCard, 'id'>) => void;
  updateCard: (id: string, patch: Partial<CreditCard>) => void;
  deleteCard: (id: string) => void;
  addDocument: (document: Omit<DocumentRecord, 'id' | 'createdAt'>) => string;
  updateDocument: (id: string, patch: Partial<DocumentRecord>) => void;
  approveDocument: (id: string, accountId?: string, categoryId?: string) => void;
  updateSettings: (patch: Partial<FinanceSettings>) => void;
  resetDemo: () => void;
}

const defaultSettings: FinanceSettings = {
  userName: 'Jéssica',
  currency: 'BRL',
  theme: 'system',
  monthlyIncomeGoal: 20_000,
  emergencyReserveMonths: 6,
  notificationsEnabled: true,
};

export const useFinanceStore = create<FinanceState>()(
  persist(
    (set, get) => ({
      accounts,
      categories,
      transactions,
      cards,
      budgets,
      goals,
      assets,
      documents: [],
      settings: defaultSettings,

      addTransaction(transaction) {
        const id = createId('tx');
        set((state) => ({
          transactions: [
            ...state.transactions,
            { ...transaction, id, createdAt: new Date().toISOString() },
          ],
        }));
        return id;
      },

      updateTransaction(id, patch) {
        set((state) => ({
          transactions: state.transactions.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }));
      },

      deleteTransaction(id) {
        set((state) => ({
          transactions: state.transactions.filter((item) => item.id !== id),
        }));
      },

      addAccount(account) {
        set((state) => ({
          accounts: [...state.accounts, { ...account, id: createId('acc') }],
        }));
      },

      updateAccount(id, patch) {
        set((state) => ({
          accounts: state.accounts.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }));
      },

      addCard(card) {
        set((state) => ({
          cards: [...state.cards, { ...card, id: createId('card') }],
        }));
      },

      updateCard(id, patch) {
        set((state) => ({
          cards: state.cards.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }));
      },

      deleteCard(id) {
        set((state) => ({
          cards: state.cards.filter((item) => item.id !== id),
        }));
      },

      addDocument(document) {
        const id = createId('doc');
        set((state) => ({
          documents: [{ ...document, id, createdAt: new Date().toISOString() }, ...state.documents],
        }));
        return id;
      },

      updateDocument(id, patch) {
        set((state) => ({
          documents: state.documents.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }));
      },

      approveDocument(id, accountId = 'acc_main', categoryId = 'cat_other') {
        const document = get().documents.find((item) => item.id === id);
        if (!document?.extracted?.value) return;

        const dueDate = document.extracted.dueDate;
        get().addTransaction({
          description:
            document.extracted.description || document.extracted.beneficiary || document.name,
          type: 'expense',
          amount: document.extracted.value,
          date: new Date().toISOString().slice(0, 10),
          dueDate,
          accountId,
          categoryId,
          status: dueDate ? 'pending' : 'paid',
          documentId: id,
        });

        set((state) => ({
          documents: state.documents.map((item) =>
            item.id === id ? { ...item, status: 'approved' } : item,
          ),
        }));
      },

      updateSettings(patch) {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
      },

      resetDemo() {
        set({
          accounts,
          categories,
          transactions,
          cards,
          budgets,
          goals,
          assets,
          documents: [],
          settings: defaultSettings,
        });
      },
    }),
    {
      name: 'conta-certa-finance-state',
      storage: createJSONStorage(() => platformStorage),
      version: 2,
    },
  ),
);
