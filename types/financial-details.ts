export interface Transaction {
  id: string;
  date: string;
  type: string;
  num: string;
  name: string;
  memo: string;
  split: string;
  amount: number;
  balance: number;
}

export interface AccountDetail {
  id: string;
  name: string;
  total: number;
  transactions: Transaction[];
}

export interface FinancialGroup {
  id: string;
  name: string;
  total: number;
  accounts: AccountDetail[];
}

export interface DetailedFinancialData {
  groups: FinancialGroup[];
  grandTotal?: number;
}

export const balanceSheetDetailData: DetailedFinancialData = { groups: [] };
export const profitLossDetailData: DetailedFinancialData = { groups: [] };
