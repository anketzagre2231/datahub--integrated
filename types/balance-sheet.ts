export interface FinancialLine {
  id: string;
  name: string;
  amount: number;
  type: "header" | "total" | "data" | "item";
  children?: FinancialLine[];
  level?: number;
}

export const balanceSheetData: FinancialLine[] = [];
