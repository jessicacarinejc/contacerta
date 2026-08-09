export type TransactionType = 'income' | 'expense' | 'transfer';
export type TransactionStatus = 'paid' | 'pending' | 'overdue' | 'cancelled';
export type AccountType = 'checking' | 'savings' | 'wallet' | 'investment';
export type DocumentStatus = 'processing' | 'review' | 'approved' | 'rejected' | 'duplicate' | 'error';

export interface Account {
  id: string;
  name: string;
  institution: string;
  type: AccountType;
  balance: number;
  color: string;
  active: boolean;
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  type: 'income' | 'expense' | 'both';
}

export interface Transaction {
  id: string;
  description: string;
  type: TransactionType;
  amount: number;
  date: string;
  dueDate?: string;
  paidAt?: string;
  accountId: string;
  destinationAccountId?: string;
  categoryId: string;
  status: TransactionStatus;
  notes?: string;
  recurring?: boolean;
  installment?: { current: number; total: number };
  thirdParty?: string;
  futureInstallment?: boolean;
  documentId?: string;
  createdAt: string;
}

export interface CreditCard {
  id: string;
  name: string;
  institution: string;
  lastDigits: string;
  limit: number;
  used: number;
  closingDay: number;
  dueDay: number;
  color: string;
}

export interface Budget {
  id: string;
  categoryId: string;
  month: string;
  limit: number;
}

export interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
  deadline: string;
  icon: string;
}

export interface Asset {
  id: string;
  name: string;
  type: 'cash' | 'investment' | 'vehicle' | 'property' | 'debt' | 'other';
  value: number;
  updatedAt: string;
}

export interface ExtractedDocumentItem {
  description: string;
  amount: number;
  date?: string;
  time?: string;
  cardLastDigits?: string;
  installment?: { current: number; total: number };
  sourceLine?: string;
}

export interface ExtractedDocumentData {
  documentType: 'boleto' | 'invoice' | 'statement' | 'receipt' | 'other';
  value?: number;
  dueDate?: string;
  beneficiary?: string;
  barcode?: string;
  description?: string;
  confidence: number;
  items?: ExtractedDocumentItem[];
  itemsTotal?: number;
  futureItems?: ExtractedDocumentItem[];
}

export interface DocumentRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  hash: string;
  status: DocumentStatus;
  progress: number;
  rawText?: string;
  extracted?: ExtractedDocumentData;
  error?: string;
  createdAt: string;
}

export interface FinanceSettings {
  userName: string;
  currency: 'BRL';
  theme: 'light' | 'dark' | 'system';
  monthlyIncomeGoal: number;
  emergencyReserveMonths: number;
  notificationsEnabled: boolean;
}
