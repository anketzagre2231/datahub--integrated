/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetchWithAuth } from "./apiService";
import { parseSummaryRows } from "./reportService";
import { DetailedFinancialData, FinancialGroup, AccountDetail, Transaction } from "@/types/financial-details";
import { FinancialLine } from "@/types/balance-sheet";

type CashflowEnginePayload = Record<string, any>;
type LooseRecord = Record<string, any>;

function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  const negativeByParens = trimmed.includes("(") && trimmed.includes(")");
  const numeric = parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return 0;

  return negativeByParens ? -Math.abs(numeric) : numeric;
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function createStableId(prefix: string, ...parts: Array<string | number | undefined | null>) {
  const suffix = parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .map((part) => normalizeKey(String(part)))
    .filter(Boolean)
    .join("-");

  return suffix ? `${prefix}-${suffix}` : `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function getQueryString(startDate?: string, endDate?: string, accountingMethod?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (accountingMethod) params.set("accounting_method", accountingMethod);
  if (accountingMethod) params.set("basis", accountingMethod);
  return params.toString() ? `?${params.toString()}` : "";
}

function getSummaryRows(payload: CashflowEnginePayload) {
  return payload?.cashflow?.Rows?.Row || payload?.Rows?.Row || payload?.data?.Rows?.Row || [];
}

function getReportDate(payload: CashflowEnginePayload, fallback?: string) {
  return payload?.cashflow?.Header?.EndPeriod || payload?.Header?.EndPeriod || payload?.data?.Header?.EndPeriod || fallback || "N/A";
}

function getRowName(row: LooseRecord) {
  return String(
    row?.Header?.ColData?.[0]?.value ||
      row?.Summary?.ColData?.[0]?.value ||
      row?.ColData?.[0]?.value ||
      "Cash Flow Item"
  );
}

function getRowTotal(row: LooseRecord) {
  const colData = row?.Summary?.ColData || row?.ColData || [];
  const lastValue = colData[colData.length - 1]?.value;
  return toNumber(lastValue);
}

function addTransaction(
  transactionMap: Map<string, Transaction[]>,
  accountIds: Array<string | undefined>,
  accountNames: Array<string | undefined>,
  transaction: Transaction
) {
  const keys = new Set<string>();

  accountIds.forEach((accountId) => {
    if (accountId) keys.add(`id:${accountId}`);
  });

  accountNames.forEach((accountName) => {
    if (accountName) keys.add(`name:${normalizeKey(accountName)}`);
  });

  keys.forEach((key) => {
    const existing = transactionMap.get(key) || [];
    existing.push(transaction);
    transactionMap.set(key, existing);
  });
}

function lineDescription(line: LooseRecord | undefined) {
  return String(
    line?.Description ||
      line?.AccountBasedExpenseLineDetail?.AccountRef?.name ||
      line?.ItemBasedExpenseLineDetail?.ItemRef?.name ||
      line?.SalesItemLineDetail?.ItemRef?.name ||
      "Line Item"
  );
}

function buildCashflowTransactionMap(payload: CashflowEnginePayload, reportDate: string) {
  const transactionMap = new Map<string, Transaction[]>();
  const transactions = payload?.transactions || {};

  toArray<LooseRecord>(transactions?.invoices?.Invoice).forEach((invoice, index) => {
    const amount = -(invoice?.TotalAmt || 0);
    addTransaction(
      transactionMap,
      ["84"],
      ["Accounts Receivable (A/R)"],
      {
        id: `invoice-${invoice?.Id || index}`,
        date: invoice?.TxnDate || reportDate,
        type: "Invoice",
        num: invoice?.DocNumber || "",
        name: invoice?.CustomerRef?.name || "Invoice",
        memo: invoice?.PrivateNote || lineDescription(invoice?.Line?.[0]),
        split: "Accounts Receivable (A/R)",
        amount,
        balance: invoice?.Balance ?? amount,
      }
    );
  });

  toArray<LooseRecord>(transactions?.payments?.Payment).forEach((payment, index) => {
    const amount = payment?.TotalAmt || 0;
    addTransaction(
      transactionMap,
      ["84"],
      ["Accounts Receivable (A/R)"],
      {
        id: `payment-${payment?.Id || index}`,
        date: payment?.TxnDate || reportDate,
        type: "Payment",
        num: payment?.PaymentRefNum || "",
        name: payment?.CustomerRef?.name || "Payment",
        memo: payment?.PrivateNote || "Customer payment",
        split: "Accounts Receivable (A/R)",
        amount,
        balance: payment?.UnappliedAmt ?? amount,
      }
    );
  });

  toArray<LooseRecord>(transactions?.bills?.Bill).forEach((bill, index) => {
    const accountId = bill?.APAccountRef?.value;
    const accountName = bill?.APAccountRef?.name || "Accounts Payable (A/P)";
    const amount = bill?.TotalAmt || 0;

    addTransaction(
      transactionMap,
      [accountId],
      [accountName],
      {
        id: `bill-${bill?.Id || index}`,
        date: bill?.TxnDate || reportDate,
        type: "Bill",
        num: bill?.DocNumber || "",
        name: bill?.VendorRef?.name || "Bill",
        memo: bill?.PrivateNote || lineDescription(bill?.Line?.[0]),
        split: accountName,
        amount,
        balance: bill?.Balance ?? amount,
      }
    );
  });

  toArray<LooseRecord>(transactions?.purchases?.Purchase).forEach((purchase, index) => {
    const accountId = purchase?.AccountRef?.value;
    const accountName = purchase?.AccountRef?.name;
    const amount = purchase?.Credit ? purchase?.TotalAmt || 0 : -(purchase?.TotalAmt || 0);

    addTransaction(
      transactionMap,
      [accountId],
      [accountName],
      {
        id: `purchase-${purchase?.Id || index}`,
        date: purchase?.TxnDate || reportDate,
        type: purchase?.PaymentType || "Purchase",
        num: purchase?.DocNumber || "",
        name: purchase?.EntityRef?.name || accountName || "Purchase",
        memo: purchase?.PrivateNote || lineDescription(purchase?.Line?.[0]),
        split: accountName || "Expense Account",
        amount,
        balance: amount,
      }
    );
  });

  toArray<LooseRecord>(transactions?.deposits?.Deposit).forEach((deposit, index) => {
    toArray<LooseRecord>(deposit?.Line).forEach((line, lineIndex) => {
      const accountId = line?.DepositLineDetail?.AccountRef?.value;
      const accountName = line?.DepositLineDetail?.AccountRef?.name;
      if (!accountId && !accountName) return;

      const amount = line?.Amount || 0;
      addTransaction(
        transactionMap,
        [accountId],
        [accountName],
        {
          id: `deposit-${deposit?.Id || index}-${lineIndex}`,
          date: deposit?.TxnDate || reportDate,
          type: "Deposit",
          num: "",
          name: accountName || "Deposit",
          memo: deposit?.PrivateNote || lineDescription(line),
          split: deposit?.DepositToAccountRef?.name || "Deposit",
          amount,
          balance: amount,
        }
      );
    });
  });

  return transactionMap;
}

function getAccountTransactions(
  accountId: string | undefined,
  accountName: string,
  total: number,
  reportDate: string,
  transactionMap: Map<string, Transaction[]>
) {
  const byId = accountId ? transactionMap.get(`id:${accountId}`) : undefined;
  const byName = transactionMap.get(`name:${normalizeKey(accountName)}`);
  const transactions = [...(byId || []), ...(byName || [])];

  if (transactions.length > 0) {
    return transactions.filter(
      (transaction, index, self) => index === self.findIndex((candidate) => candidate.id === transaction.id)
    );
  }

  return [
    {
      id: createStableId("cashflow-fallback", accountId, accountName),
      date: reportDate,
      type: "Summary",
      num: "",
      name: accountName,
      memo: "Generated from cash flow summary",
      split: accountName,
      amount: total,
      balance: total,
    },
  ];
}

function collectAccounts(
  rows: LooseRecord[],
  reportDate: string,
  transactionMap: Map<string, Transaction[]>
): AccountDetail[] {
  const accounts: AccountDetail[] = [];

  rows.forEach((row, index) => {
    const type = String(row?.type || "").toLowerCase();

    if (type === "data" || !row?.type) {
      const accountName = getRowName(row);
      const accountId = row?.ColData?.[0]?.id;
      const total = getRowTotal(row);
      accounts.push({
        id: String(accountId || row?.group || createStableId("cashflow-account", accountName, index)),
        name: accountName,
        total,
        transactions: getAccountTransactions(accountId, accountName, total, reportDate, transactionMap),
      });
      return;
    }

    if (type === "section") {
      const nestedRows = toArray(row?.Rows?.Row);
      if (nestedRows.length > 0) {
        accounts.push(...collectAccounts(nestedRows, reportDate, transactionMap));
        return;
      }

      const accountName = getRowName(row);
      const total = getRowTotal(row);
      accounts.push({
        id: String(row?.group || createStableId("cashflow-account", accountName, index)),
        name: accountName,
        total,
        transactions: getAccountTransactions(undefined, accountName, total, reportDate, transactionMap),
      });
    }
  });

  return accounts;
}

function parseCashflowDetail(payload: CashflowEnginePayload, fallbackDate?: string): DetailedFinancialData {
  const reportDate = getReportDate(payload, fallbackDate);
  const rows = getSummaryRows(payload);
  const transactionMap = buildCashflowTransactionMap(payload, reportDate);

  const groups: FinancialGroup[] = rows.map((row: LooseRecord, index: number) => {
    const groupName = getRowName(row);
    const total = getRowTotal(row);
    const accounts = row?.Rows?.Row
      ? collectAccounts(toArray(row.Rows.Row), reportDate, transactionMap)
      : [{
          id: String(row?.group || createStableId("cashflow-account", groupName, index)),
          name: groupName,
          total,
          transactions: getAccountTransactions(undefined, groupName, total, reportDate, transactionMap),
        }];

    return {
      id: String(row?.group || createStableId("cashflow-group", groupName, index)),
      name: groupName,
      total,
      accounts,
    };
  });

  return {
    groups,
    grandTotal: groups.reduce((sum, group) => sum + group.total, 0),
  };
}

export async function getCashflow(
  startDate?: string,
  endDate?: string,
  accountingMethod?: string
): Promise<FinancialLine[]> {
  try {
    const qs = getQueryString(startDate, endDate, accountingMethod);
    const json = await fetchWithAuth(`/qb-cashflow${qs}`);
    return parseSummaryRows(getSummaryRows(json));
  } catch (err) {
    console.warn("Returning empty Cashflow due to error:", err);
    return [];
  }
}

export async function getCashflowDetail(
  startDate?: string,
  endDate?: string,
  accountingMethod?: string
): Promise<DetailedFinancialData> {
  try {
    const qs = getQueryString(startDate, endDate, accountingMethod);
    const json = await fetchWithAuth(`/qb-cashflow-engine${qs}`);
    return parseCashflowDetail(json, endDate);
  } catch (err) {
    console.warn("Returning empty Cashflow Detail due to error:", err);
    return { groups: [] };
  }
}

