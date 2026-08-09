import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  accounts as demoAccounts,
  assets as demoAssets,
  budgets as demoBudgets,
  cards as demoCards,
  categories,
  goals as demoGoals,
  transactions as demoTransactions,
} from '../data/seed';
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
  deleteAccount: (id: string) => boolean;
  addCard: (card: Omit<CreditCard, 'id'>) => void;
  updateCard: (id: string, patch: Partial<CreditCard>) => void;
  deleteCard: (id: string) => void;
  addBudget: (budget: Omit<Budget, 'id'>) => void;
  updateBudget: (id: string, patch: Partial<Omit<Budget, 'id'>>) => void;
  deleteBudget: (id: string) => void;
  addGoal: (goal: Omit<Goal, 'id'>) => void;
  updateGoal: (id: string, patch: Partial<Omit<Goal, 'id'>>) => void;
  deleteGoal: (id: string) => void;
  addAsset: (asset: Omit<Asset, 'id' | 'updatedAt'>) => void;
  updateAsset: (id: string, patch: Partial<Omit<Asset, 'id'>>) => void;
  deleteAsset: (id: string) => void;
  addDocument: (document: Omit<DocumentRecord, 'id' | 'createdAt'>) => string;
  updateDocument: (id: string, patch: Partial<DocumentRecord>) => void;
  approveDocument: (id: string, accountId?: string, categoryId?: string) => boolean;
  updateSettings: (patch: Partial<FinanceSettings>) => void;
  clearFinancialData: () => void;
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
      accounts: [],
      categories,
      transactions: [],
      cards: [],
      budgets: [],
      goals: [],
      assets: [],
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
        set((state) => ({ transactions: state.transactions.filter((item) => item.id !== id) }));
      },

      addAccount(account) {
        set((state) => ({
          accounts: [...state.accounts, { ...account, id: createId('acc') }],
        }));
      },

      updateAccount(id, patch) {
        set((state) => ({
          accounts: state.accounts.map((item) =>
            item.id === id ? { ...item, ...patch } : item,
          ),
        }));
      },

      deleteAccount(id) {
        const referenced = get().transactions.some(
          (item) => item.accountId === id || item.destinationAccountId === id,
        );
        if (referenced) return false;
        set((state) => ({ accounts: state.accounts.filter((item) => item.id !== id) }));
        return true;
      },

      addCard(card) {
        set((state) => ({ cards: [...state.cards, { ...card, id: createId('card') }] }));
      },

      updateCard(id, patch) {
        set((state) => ({
          cards: state.cards.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }));
      },

      deleteCard(id) {
        set((state) => ({ cards: state.cards.filter((item) => item.id !== id) }));
      },

      addBudget(budget) {
        set((state) => ({ budgets: [...state.budgets, { ...budget, id: createId('budget') }] }));
      },

      updateBudget(id, patch) {
        set((state) => ({
          budgets: state.budgets.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }));
      },

      deleteBudget(id) {
        set((state) => ({ budgets: state.budgets.filter((item) => item.id !== id) }));
      },

      addGoal(goal) {
        set((state) => ({ goals: [...state.goals, { ...goal, id: createId('goal') }] }));
      },

      updateGoal(id, patch) {
        set((state) => ({
          goals: state.goals.map((item) => (item.id === id ? { ...item, ...patch } : item)),
        }));
      },

      deleteGoal(id) {
        set((state) => ({ goals: state.goals.filter((item) => item.id !== id) }));
      },

      addAsset(asset) {
        set((state) => ({
          assets: [
            ...state.assets,
            { ...asset, id: createId('asset'), updatedAt: new Date().toISOString() },
          ],
        }));
      },

      updateAsset(id, patch) {
        set((state) => ({
          assets: state.assets.map((item) =>
            item.id === id
              ? { ...item, ...patch, updatedAt: new Date().toISOString() }
              : item,
          ),
        }));
      },

      deleteAsset(id) {
        set((state) => ({ assets: state.assets.filter((item) => item.id !== id) }));
      },

      addDocument(document) {
        const id = createId('doc');
        set((state) => ({
          documents: [
            { ...document, id, createdAt: new Date().toISOString() },
            ...state.documents,
          ],
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

      approveDocument(id, accountId, categoryId) {
        const state = get();
        const document = state.documents.find((item) => item.id === id);
        if (!document?.extracted) return false;

        const resolvedAccountId =
          accountId && state.accounts.some((item) => item.id === accountId)
            ? accountId
            : state.accounts[0]?.id;
        const resolvedCategoryId =
          categoryId && state.categories.some((item) => item.id === categoryId)
            ? categoryId
            : state.categories.find((item) => item.type !== 'income')?.id;
        if (!resolvedAccountId || !resolvedCategoryId) return false;

        const extracted = document.extracted;
        const dueDate = extracted.dueDate;
        const invoiceItems =
          extracted.documentType === 'invoice'
            ? (extracted.items || []).filter((item) => item.amount > 0 && item.description.trim())
            : [];

        if (extracted.documentType === 'invoice' && invoiceItems.length === 0) {
          // Segurança: nunca transforma o total de uma fatura em despesa se as compras individuais
          // não puderam ser identificadas. Isso evita duplicidade e lançamentos absurdos.
          return false;
        }

        if (invoiceItems.length > 0) {
          for (const item of invoiceItems) {
            get().addTransaction({
              description: item.description,
              type: 'expense',
              amount: item.amount,
              date: item.date || new Date().toISOString().slice(0, 10),
              dueDate,
              accountId: resolvedAccountId,
              categoryId: resolvedCategoryId,
              status: dueDate ? 'pending' : 'paid',
              installment: item.installment,
              notes: `Item importado da fatura ${document.name}. O valor total da fatura não foi lançado como nova despesa.`,
              documentId: id,
            });
          }
        } else {
          if (!extracted.value) return false;
          get().addTransaction({
            description: extracted.description || extracted.beneficiary || document.name,
            type: 'expense',
            amount: extracted.value,
            date: new Date().toISOString().slice(0, 10),
            dueDate,
            accountId: resolvedAccountId,
            categoryId: resolvedCategoryId,
            status: dueDate ? 'pending' : 'paid',
            documentId: id,
          });
        }

        set((current) => ({
          documents: current.documents.map((item) =>
            item.id === id ? { ...item, status: 'approved' } : item,
          ),
        }));
        return true;
      },

      updateSettings(patch) {
        set((state) => ({ settings: { ...state.settings, ...patch } }));
      },

      clearFinancialData() {
        set((state) => ({
          accounts: [],
          categories,
          transactions: [],
          cards: [],
          budgets: [],
          goals: [],
          assets: [],
          documents: [],
          settings: state.settings,
        }));
      },

      resetDemo() {
        set({
          accounts: demoAccounts,
          categories,
          transactions: demoTransactions,
          cards: demoCards,
          budgets: demoBudgets,
          goals: demoGoals,
          assets: demoAssets,
          documents: [],
          settings: defaultSettings,
        });
      },
    }),
    {
      name: 'conta-certa-finance-state',
      storage: createJSONStorage(() => platformStorage),
      version: 1,
    },
  ),
);
