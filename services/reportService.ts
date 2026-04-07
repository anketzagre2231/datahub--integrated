import {
  DollarSign,
  Wallet,
  TrendingUp,
  Building2,
  CreditCard,
  Scale,
  RefreshCw,
  PiggyBank,
  ArrowDownToLine,
  Package,
  ArrowUpFromLine,
  Landmark,
} from "lucide-react";

import { fetchWithAuth } from "./apiService";

import { FinancialLine } from "@/types/balance-sheet";
import {
  DetailedFinancialData,
  FinancialGroup,
  AccountDetail,
  Transaction,
} from "@/types/financial-details";

type SupportedReportType = "Balance Sheet" | "Profit & Loss" | "Cashflow";
type SupportedReportMode = "summary" | "detail";

const FALLBACK_TRANSACTION_DATE = "N/A";

function createStableId(prefix: string, ...parts: Array<string | number | undefined | null>) {
  const suffix = parts
    .filter((part) => part !== undefined && part !== null && String(part).trim() !== "")
    .map((part) => String(part).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-"))
    .filter(Boolean)
    .join("-");

  return suffix ? `${prefix}-${suffix}` : `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function toNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const normalized = trimmed.replace(/[$,%\s]/g, "");
    const isNegativeByParens = normalized.includes("(") && normalized.includes(")");
    const numeric = parseFloat(normalized.replace(/[(),]/g, ""));
    if (!Number.isFinite(numeric)) return 0;
    return isNegativeByParens ? -Math.abs(numeric) : numeric;
  }
  return 0;
}

function asArray<T = any>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

function getRootPayload(apiData: any) {
  return apiData?.data ?? apiData;
}

function getRowsFromPayload(apiData: any): any[] {
  const root = getRootPayload(apiData);
  return root?.Rows?.Row || [];
}

function getReportDate(apiData: any) {
  const root = getRootPayload(apiData);
  return root?.Header?.EndPeriod || root?.Header?.ReportDate || root?.reportDate || FALLBACK_TRANSACTION_DATE;
}

function pickFirst<T = unknown>(source: any, paths: string[]): T | undefined {
  for (const path of paths) {
    const parts = path.split(".");
    let current = source;
    let found = true;

    for (const part of parts) {
      if (current == null || !(part in current)) {
        found = false;
        break;
      }
      current = current[part];
    }

    if (found && current !== undefined && current !== null) {
      return current as T;
    }
  }

  return undefined;
}

function isQuickBooksRowsPayload(apiData: any) {
  return getRowsFromPayload(apiData).length > 0;
}

function normalizeLineName(item: any, fallback = "Unnamed Item") {
  return String(
    pickFirst(item, [
      "name",
      "title",
      "label",
      "account",
      "accountName",
      "group",
      "category",
      "description",
      "Header.ColData.0.value",
      "Summary.ColData.0.value",
      "ColData.0.value",
    ]) ?? fallback
  );
}

function normalizeLineAmount(item: any) {
  return toNumber(
    pickFirst(item, [
      "amount",
      "value",
      "total",
      "balance",
      "netAmount",
      "net",
      "closingBalance",
      "Summary.ColData.1.value",
      "ColData.1.value",
      "ColData.0.value",
    ])
  );
}

function getNestedLineCollections(item: any) {
  return [
    ...asArray<any>(item?.items),
    ...asArray<any>(item?.children),
    ...asArray<any>(item?.lines),
    ...asArray<any>(item?.accounts),
    ...asArray<any>(item?.sections),
    ...asArray<any>(item?.groups),
    ...asArray<any>(item?.rows),
  ];
}

function looksLikeTotal(name: string, node: any, parentKey?: string) {
  const lowerName = name.toLowerCase();
  const lowerKey = (parentKey || "").toLowerCase();
  return lowerName.startsWith("total ") ||
    lowerName.includes("net cash") ||
    lowerName.includes("net income") ||
    lowerName.includes("ending cash") ||
    lowerName.includes("cash at end") ||
    lowerKey.includes("total");
}

function normalizeSummaryNode(node: any, parentKey?: string, index = 0): FinancialLine | null {
  if (node == null) return null;

  if (typeof node === "string" || typeof node === "number") {
    const amount = toNumber(node);
    return {
      id: createStableId("line", parentKey, index),
      name: parentKey || "Value",
      amount,
      type: looksLikeTotal(parentKey || "", node, parentKey) ? "total" : "data",
    };
  }

  const childCandidates = getNestedLineCollections(node);
  const children = childCandidates
    .map((child, childIndex) => normalizeSummaryNode(child, normalizeLineName(node, parentKey || "Section"), childIndex))
    .filter(Boolean) as FinancialLine[];

  const name = normalizeLineName(node, parentKey || `Section ${index + 1}`);
  const amountFromNode = normalizeLineAmount(node);
  const computedChildrenTotal = children.reduce((sum, child) => sum + (child.amount || 0), 0);
  const amount = amountFromNode || computedChildrenTotal;
  const type: FinancialLine["type"] = children.length > 0
    ? "header"
    : looksLikeTotal(name, node, parentKey)
      ? "total"
      : "data";

  return {
    id: String(pickFirst(node, ["id", "key"]) ?? createStableId("line", name, index)),
    name,
    amount,
    type,
    children: children.length > 0 ? children : undefined,
  };
}

function normalizeSummaryFromCollections(reportType: SupportedReportType, apiData: any): FinancialLine[] {
  const root = getRootPayload(apiData);
  const explicitSections = asArray<any>(
    pickFirst(root, ["sections", "groups", "categories", "items", "rows", "lines"])
  );

  const collections: Array<{ key: string; label: string; values: any[] }> = [];
  const pushCollection = (key: string, label: string, values: unknown) => {
    const list = asArray<any>(values).filter((value) => value !== undefined && value !== null);
    if (list.length > 0) {
      collections.push({ key, label, values: list });
    }
  };

  if (explicitSections.length > 0) {
    pushCollection("sections", "Sections", explicitSections);
  }

  if (reportType === "Profit & Loss") {
    pushCollection("income", "Income", pickFirst(root, ["income", "revenues", "revenue", "operatingIncome"]));
    pushCollection("otherIncome", "Other Income", pickFirst(root, ["otherIncome", "other_income"]));
    pushCollection("costOfGoodsSold", "Cost of Goods Sold", pickFirst(root, ["costOfGoodsSold", "cogs"]));
    pushCollection("expenses", "Expenses", pickFirst(root, ["expenses", "operatingExpenses"]));
    pushCollection("otherExpenses", "Other Expenses", pickFirst(root, ["otherExpenses", "other_expenses"]));
  }

  if (reportType === "Cashflow") {
    pushCollection("operatingActivities", "Operating Activities", pickFirst(root, ["operatingActivities", "operating", "operations"]));
    pushCollection("investingActivities", "Investing Activities", pickFirst(root, ["investingActivities", "investing"]));
    pushCollection("financingActivities", "Financing Activities", pickFirst(root, ["financingActivities", "financing"]));
    pushCollection("inflow", "Cash Inflow", pickFirst(root, ["inflow", "cashInflow"]));
    pushCollection("outflow", "Cash Outflow", pickFirst(root, ["outflow", "cashOutflow"]));
  }

  const normalizedCollections = collections.map((collection, index) => {
    const normalizedChildren = collection.values
      .map((item, itemIndex) => normalizeSummaryNode(item, collection.label, itemIndex))
      .filter(Boolean) as FinancialLine[];

    if (normalizedChildren.length === 1 && normalizedChildren[0].children?.length) {
      return normalizedChildren[0];
    }

    const totalFromRoot = toNumber((root as any)?.[`${collection.key}Total`]);
    const total = totalFromRoot || normalizedChildren.reduce((sum, child) => sum + (child.amount || 0), 0);

    return {
      id: createStableId("section", collection.key, index),
      name: collection.label,
      amount: total,
      type: "header" as const,
      children: normalizedChildren,
    };
  });

  if (normalizedCollections.length > 0) {
    return normalizedCollections;
  }

  if (Array.isArray(root)) {
    return root
      .map((item, index) => normalizeSummaryNode(item, reportType, index))
      .filter(Boolean) as FinancialLine[];
  }

  const fallbackEntries = Object.entries(root || {})
    .filter(([, value]) => Array.isArray(value) || (value && typeof value === "object"))
    .map(([key, value], index) => normalizeSummaryNode({ name: key, items: asArray(value) }, key, index))
    .filter(Boolean) as FinancialLine[];

  return fallbackEntries;
}

function normalizeTransaction(tx: any, index: number, reportDate: string, fallbackName: string): Transaction {
  const name = String(
    pickFirst(tx, ["name", "description", "account", "label", "title", "payee", "memo"]) ?? fallbackName
  );

  const amount = toNumber(
    pickFirst(tx, ["amount", "value", "total", "balance", "netAmount", "debit", "credit"])
  );

  return {
    id: String(pickFirst(tx, ["id", "txnId", "transactionId"]) ?? createStableId("tx", name, index)),
    date: String(pickFirst(tx, ["date", "txnDate", "transactionDate"]) ?? reportDate),
    type: String(pickFirst(tx, ["type", "txnType", "transactionType"]) ?? "Summary"),
    num: String(pickFirst(tx, ["num", "docNumber", "reference"]) ?? ""),
    name,
    memo: String(pickFirst(tx, ["memo", "notes", "description"]) ?? ""),
    split: String(pickFirst(tx, ["split", "category", "group", "accountType"]) ?? ""),
    amount,
    balance: toNumber(pickFirst(tx, ["balance", "runningBalance"])) || amount,
  };
}

function normalizeAccount(account: any, index: number, reportDate: string): AccountDetail | null {
  if (account == null) return null;

  const accountName = normalizeLineName(account, `Account ${index + 1}`);
  const rawTransactions = [
    ...asArray<any>(account?.transactions),
    ...asArray<any>(account?.items),
    ...asArray<any>(account?.lines),
    ...asArray<any>(account?.entries),
    ...asArray<any>(account?.rows),
  ];

  const transactions = rawTransactions.length > 0
    ? rawTransactions.map((tx, txIndex) => normalizeTransaction(tx, txIndex, reportDate, accountName))
    : [normalizeTransaction(account, 0, reportDate, accountName)];

  const total = toNumber(pickFirst(account, ["total", "amount", "value", "balance"])) ||
    transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);

  return {
    id: String(pickFirst(account, ["id", "key"]) ?? createStableId("account", accountName, index)),
    name: accountName,
    total,
    transactions,
  };
}

function normalizeGroup(group: any, index: number, reportDate: string): FinancialGroup | null {
  if (group == null) return null;

  const groupName = normalizeLineName(group, `Group ${index + 1}`);
  const rawAccounts = [
    ...asArray<any>(group?.accounts),
    ...asArray<any>(group?.items),
    ...asArray<any>(group?.lines),
    ...asArray<any>(group?.entries),
    ...asArray<any>(group?.rows),
    ...asArray<any>(group?.children),
  ];

  const accounts = rawAccounts.length > 0
    ? rawAccounts.map((account, accountIndex) => normalizeAccount(account, accountIndex, reportDate)).filter(Boolean) as AccountDetail[]
    : [normalizeAccount(group, 0, reportDate)].filter(Boolean) as AccountDetail[];

  const total = toNumber(pickFirst(group, ["total", "amount", "value", "balance"])) ||
    accounts.reduce((sum, account) => sum + (account.total || 0), 0);

  return {
    id: String(pickFirst(group, ["id", "key"]) ?? createStableId("group", groupName, index)),
    name: groupName,
    total,
    accounts,
  };
}

function normalizeDetailFromCollections(reportType: SupportedReportType, apiData: any): DetailedFinancialData {
  const root = getRootPayload(apiData);
  const reportDate = getReportDate(apiData);

  const explicitGroups = asArray<any>(pickFirst(root, ["groups", "sections", "categories"]));
  const groupsToNormalize: any[] = [...explicitGroups];

  const appendWrappedGroup = (label: string, values: unknown) => {
    const list = asArray<any>(values).filter((value) => value !== undefined && value !== null);
    if (list.length > 0) {
      groupsToNormalize.push({ name: label, items: list });
    }
  };

  if (reportType === "Profit & Loss") {
    appendWrappedGroup("Income", pickFirst(root, ["income", "revenues", "revenue", "operatingIncome"]));
    appendWrappedGroup("Other Income", pickFirst(root, ["otherIncome", "other_income"]));
    appendWrappedGroup("Expenses", pickFirst(root, ["expenses", "operatingExpenses"]));
    appendWrappedGroup("Other Expenses", pickFirst(root, ["otherExpenses", "other_expenses"]));
  }

  if (reportType === "Cashflow") {
    appendWrappedGroup("Operating Activities", pickFirst(root, ["operatingActivities", "operating", "operations"]));
    appendWrappedGroup("Investing Activities", pickFirst(root, ["investingActivities", "investing"]));
    appendWrappedGroup("Financing Activities", pickFirst(root, ["financingActivities", "financing"]));
    appendWrappedGroup("Cash Inflow", pickFirst(root, ["inflow", "cashInflow"]));
    appendWrappedGroup("Cash Outflow", pickFirst(root, ["outflow", "cashOutflow"]));
  }

  const groups = (groupsToNormalize.length > 0 ? groupsToNormalize : asArray<any>(root))
    .map((group, index) => normalizeGroup(group, index, reportDate))
    .filter(Boolean) as FinancialGroup[];

  const dedupedGroups = groups.filter((group, index, self) =>
    index === self.findIndex((candidate) => candidate.name === group.name && candidate.accounts.length === group.accounts.length)
  );

  return {
    groups: dedupedGroups,
    grandTotal: toNumber(pickFirst(root, ["grandTotal", "total", "closingBalance"])) ||
      dedupedGroups.reduce((sum, group) => sum + (group.total || 0), 0),
  };
}

export function normalizeReportData(
  reportType: SupportedReportType,
  reportMode: SupportedReportMode,
  apiData: any
): FinancialLine[] | DetailedFinancialData {
  if (reportMode === "summary") {
    if (isQuickBooksRowsPayload(apiData)) {
      return parseSummaryRows(getRowsFromPayload(apiData));
    }

    return normalizeSummaryFromCollections(reportType, apiData);
  }

  if (isQuickBooksRowsPayload(apiData)) {
    return parseDetailRows(getRowsFromPayload(apiData), getReportDate(apiData));
  }

  return normalizeDetailFromCollections(reportType, apiData);
}

// --- Parsers for Summary Reports ---
export function parseSummaryRows(rows: any[], indexOffset = 0): FinancialLine[] {
  let result: FinancialLine[] = [];
  if (!rows || !Array.isArray(rows)) return result;

  let childIndex = indexOffset;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const type = row.type?.toLowerCase();

    if (type === "section") {
      const name =
        row.Header?.ColData?.[0]?.value ||
        row.Summary?.ColData?.[0]?.value ||
        row.ColData?.[0]?.value ||
        "Section";
      const summaryCols = row.Summary?.ColData || [];
      const totalStr =
        [...summaryCols]
          .reverse()
          .find(
            (c: any) =>
              c.value && !isNaN(parseFloat(c.value?.replace(/,/g, ""))),
          )?.value || "0";
      const totalAmount = parseFloat(totalStr?.replace(/,/g, "")) || 0;

      const children: FinancialLine[] = [];
      if (row.Rows?.Row) {
        children.push(...parseSummaryRows(row.Rows.Row, childIndex));
      } else if (row.Rows && Array.isArray(row.Rows)) {
        children.push(...parseSummaryRows(row.Rows, childIndex));
      }
      childIndex += children.length;

      const cleanName = name.replace(/^Total\s+/i, "").replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      const sectionId = row.group || row.id || `section-${cleanName}-${indexOffset + i}`;

      if (row.Summary && children.length > 0) {
        const summaryName = row.Summary.ColData?.[0]?.value || `Total ${cleanName}`;
        const summaryId = `total-${cleanName}-${indexOffset + i}`;
        children.push({
          id: summaryId,
          name: summaryName,
          amount: totalAmount,
          type: "total"
        });
      }

      result.push({
        id: sectionId,
        name: cleanName.replace(/-/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase()),
        amount: totalAmount,
        type: "header",
        children: children.length > 0 ? children : undefined
      });
    } else if (type === "data") {
      const name = row.ColData?.[0]?.value || "Unknown";
      const valStr = row.ColData?.[1]?.value || "0";
      let amount = parseFloat(valStr?.replace(/,/g, "")) || 0;
      if (typeof valStr === 'string' && valStr.includes('(') && valStr.includes(')')) {
        amount = -Math.abs(amount);
      }
      const dataName = name.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      result.push({
        id: row.ColData?.[0]?.id || `data-${dataName}-${indexOffset + i}`,
        name,
        amount,
        type: "data",
      });
    }
  }
  return result;
}

// --- Parsers for Detail Reports ---
const extractTransactions = (
  rowArray: any[],
  reportDate: string = "N/A",
): Transaction[] => {
  let txs: Transaction[] = [];
  if (!rowArray) return txs;

  for (const r of rowArray) {
    const type = r.type?.toLowerCase();

    if (type === "data") {
      const c = r.ColData || [];
      if (c.length === 0) continue;

      const isSummary = c.length < 5;
      const rawAmount = isSummary
        ? c[c.length - 1]?.value || "0"
        : c[6]?.value || "0";
      const rawBalance = isSummary
        ? c[c.length - 1]?.value || "0"
        : c[7]?.value || "0";

      txs.push({
        id: Math.random().toString(),
        date: isSummary ? "Sub-Total" : c[0]?.value || reportDate,
        type: isSummary ? "Summary" : c[1]?.value || "Transaction",
        num: isSummary ? "" : c[2]?.value || "",
        name: isSummary ? c[0]?.value || "Total" : c[3]?.value || "N/A",
        memo: isSummary ? "" : c[4]?.value || "",
        split: isSummary ? "" : c[5]?.value || "",
        amount: parseFloat(String(rawAmount).replace(/,/g, "")) || 0,
        balance: parseFloat(String(rawBalance).replace(/,/g, "")) || 0,
      });
    } else if (type === "section" && r.Rows?.Row) {
      const hasDirectData = rowArray.some((row: any) => row.type?.toLowerCase() === "data");
      if (!hasDirectData) {
        txs.push(...extractTransactions(r.Rows.Row, reportDate));
      }
    }
  }
  return txs;
};

const findAccounts = (rows: any[], reportDate: string): AccountDetail[] => {
  let accounts: AccountDetail[] = [];
  if (!rows || !Array.isArray(rows)) return accounts;

  for (const row of rows) {
    const type = row.type?.toLowerCase();

    if (type === "section") {
      const headerName = row.Header?.ColData?.[0]?.value || row.Summary?.ColData?.[0]?.value || row.ColData?.[0]?.value || "General Account";
      const summaryCols = row.Summary?.ColData || [];
      const totalStr =
        [...summaryCols]
          .reverse()
          .find(
            (c: any) =>
              c.value && !isNaN(parseFloat(c.value?.replace(/,/g, ""))),
          )?.value || "0";
      const total = parseFloat(totalStr.replace(/,/g, "")) || 0;

      if (row.Rows?.Row) {
        const rowData = row.Rows.Row;
        const directData = rowData.filter((r: any) => r.type?.toLowerCase() === "data");

        if (directData.length > 0) {
          accounts.push({
            id: row.id || `acc-${Math.random().toString(36).substr(2, 5)}`,
            name: headerName.replace(/^Total\s+/i, ""),
            total,
            transactions: extractTransactions(directData, reportDate),
          });
        }

        accounts.push(...findAccounts(rowData, reportDate));
      } else if (row.Rows && Array.isArray(row.Rows)) {
        accounts.push(...findAccounts(row.Rows, reportDate));
      }
    }
  }
  return accounts;
};

export function parseDetailRows(
  rows: any[],
  reportDate: string = "N/A",
): DetailedFinancialData {
  const groups: FinancialGroup[] = [];
  if (!rows || !Array.isArray(rows)) return { groups };

  for (const row of rows) {
    const type = row.type?.toLowerCase();
    if (type === "section") {
      const groupName = row.Header?.ColData?.[0]?.value || row.Summary?.ColData?.[0]?.value || "Main Section";
      const summaryCols = row.Summary?.ColData || [];
      const totalStr =
        [...summaryCols]
          .reverse()
          .find(
            (c: any) =>
              c.value && !isNaN(parseFloat(c.value?.replace(/,/g, ""))),
          )?.value || "0";
      const total = parseFloat(totalStr.replace(/,/g, "")) || 0;

      const accounts = findAccounts(row.Rows?.Row || [], reportDate);

      if (accounts.length > 0) {
        groups.push({
          id: row.id || Math.random().toString(),
          name: groupName,
          total,
          accounts,
        });
      } else if (row.Rows?.Row) {
        const subData = parseDetailRows(row.Rows.Row, reportDate);
        groups.push(...subData.groups);
      }
    }
  }

  return {
    groups: groups.filter((g, idx, self) =>
      idx === self.findIndex((t) => t.name === g.name && t.accounts.length === g.accounts.length)
    )
  };
}

export function parseBalanceSheet(data: any): FinancialLine[] {
  const rows = data?.data?.Rows?.Row || data?.Rows?.Row || [];
  return parseSummaryRows(rows);
}

export function parseProfitAndLoss(data: any): FinancialLine[] {
  const rows = data?.data?.Rows?.Row || data?.Rows?.Row || [];
  return parseSummaryRows(rows);
}

// Helper function to find value by group name
const findValueByGroup = (rows: any[], groupName: string): number | null => {
  if (!rows) return null;

  for (const row of rows) {
    if (row.group === groupName) {
      const val = row.Summary?.ColData?.[1]?.value || row.ColData?.[1]?.value;
      if (val !== undefined) return parseFloat(String(val).replace(/,/g, ""));
    }
    if (row.Rows?.Row) {
      const val = findValueByGroup(row.Rows.Row, groupName);
      if (val !== null) return val;
    }
  }
  return null;
};

// Helper function to find value by name substring
const findValueByName = (rows: any[], nameSubstring: string): number | null => {
  if (!rows) return null;

  for (const row of rows) {
    const rowName =
      row.Summary?.ColData?.[0]?.value ||
      row.Header?.ColData?.[0]?.value ||
      row.ColData?.[0]?.value ||
      "";
    if (rowName.toLowerCase().includes(nameSubstring.toLowerCase())) {
      const val = row.Summary?.ColData?.[1]?.value || row.ColData?.[1]?.value;
      if (val !== undefined) return parseFloat(String(val).replace(/,/g, ""));
    }
    if (row.Rows?.Row) {
      const val = findValueByName(row.Rows.Row, nameSubstring);
      if (val !== null) return val;
    }
  }
  return null;
};

// Extract revenue and expenses totals from P&L rows
const extractRevenueAndExpenses = (
  rows: any[],
): { revenue: number; expenses: number } => {
  // Try multiple strategies to find the right values

  // Strategy 1: find by group key
  const incomeByGroup =
    findValueByGroup(rows, "Income") ||
    findValueByGroup(rows, "OrdinaryRevenue") ||
    findValueByGroup(rows, "GrossProfit") ||
    null;

  const expensesByGroup =
    findValueByGroup(rows, "Expenses") ||
    findValueByGroup(rows, "TotalExpenses") ||
    findValueByGroup(rows, "COGS") ||
    null;

  // Strategy 2: find by name substring (walk all rows)
  const incomeByName =
    findValueByName(rows, "Total Income") ||
    findValueByName(rows, "Total Revenue") ||
    findValueByName(rows, "Gross Profit") ||
    findValueByName(rows, "Income") ||
    findValueByName(rows, "Revenue") ||
    null;

  const expensesByName =
    findValueByName(rows, "Total Expenses") ||
    findValueByName(rows, "Total Expense") ||
    findValueByName(rows, "Expenses") ||
    null;

  // Strategy 3: Walk the top-level rows and grab summary values from first two sections
  let firstSectionValue = 0;
  let secondSectionValue = 0;
  let sectionCount = 0;
  for (const row of rows) {
    if (row.type === "Section") {
      const sectionName =
        row.Header?.ColData?.[0]?.value ||
        row.Summary?.ColData?.[0]?.value ||
        "";
      const summaryVal = parseFloat(
        String(
          row.Summary?.ColData?.[1]?.value ||
            row.Summary?.ColData?.[row.Summary?.ColData?.length - 1]?.value ||
            "0",
        ).replace(/,/g, ""),
      );

      if (
        sectionName.toLowerCase().includes("income") ||
        sectionName.toLowerCase().includes("revenue") ||
        sectionName.toLowerCase().includes("gross profit")
      ) {
        firstSectionValue = summaryVal;
      } else if (
        sectionName.toLowerCase().includes("expense") ||
        sectionName.toLowerCase().includes("cost")
      ) {
        secondSectionValue = summaryVal;
      }
      sectionCount++;
    }
  }

  const revenue = incomeByGroup ?? incomeByName ?? firstSectionValue ?? 0;
  const expenses = expensesByGroup ?? expensesByName ?? secondSectionValue ?? 0;

  return { revenue: Math.abs(revenue), expenses: Math.abs(expenses) };
};

// Main function to fetch KPIs with date range
export async function fetchDashboardKPIs(
  startDate?: string,
  endDate?: string,
): Promise<
  Array<{
    label: string;
    value: string;
    desc: string;
    icon: any;
    color: string;
    rawValue?: number;
  }>
> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");

  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString() ? `?${params.toString()}` : "";

  const balanceSheetUrl = `${baseUrl}/balance-sheet-detail${qs}`;
  const profitLossUrl = `${baseUrl}/profit-and-loss-statement${qs}`;

  console.log("[fetchDashboardKPIs] Balance Sheet URL →", balanceSheetUrl);
  console.log("[fetchDashboardKPIs] Profit & Loss URL →", profitLossUrl);

  try {
    const [balanceSheetJson, profitLossJson] = await Promise.all([
      fetchWithAuth(`/balance-sheet-detail${qs}`),
      fetchWithAuth(`/profit-and-loss-statement${qs}`),
    ]);

    const balanceRows =
      balanceSheetJson?.data?.Rows?.Row || balanceSheetJson?.Rows?.Row || [];
    const profitRows =
      profitLossJson?.data?.Rows?.Row || profitLossJson?.Rows?.Row || [];

    const totalAssets = findValueByGroup(balanceRows, "TotalAssets") || 0;
    const totalLiabilities = findValueByGroup(balanceRows, "Liabilities") || 0;
    const totalEquity = findValueByGroup(balanceRows, "Equity") || 0;
    const currentAssets = findValueByGroup(balanceRows, "CurrentAssets") || 0;
    const currentLiabilities =
      findValueByGroup(balanceRows, "CurrentLiabilities") || 0;
    const workingCapital = currentAssets - currentLiabilities;
    const cashBank = findValueByGroup(balanceRows, "BankAccounts") || 0;
    const accountsReceivable = findValueByGroup(balanceRows, "AR") || 0;
    const inventoryValue = findValueByName(balanceRows, "Inventory") || 0;
    const accountsPayable = findValueByGroup(balanceRows, "AP") || 0;
    const longTermDebt =
      findValueByGroup(balanceRows, "LongTermLiabilities") || 0;

    const { revenue: totalRevenue, expenses: totalExpenses } =
      extractRevenueAndExpenses(profitRows);
    const netProfit = totalRevenue - totalExpenses;

    const formatCurrency = (num: number | null) =>
      "$" +
      (num || 0).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

    return [
      {
        label: "Total Revenue",
        value: formatCurrency(totalRevenue),
        desc: "Total gross income",
        icon: DollarSign,
        color: "#8bc53d",
        rawValue: totalRevenue,
      },
      {
        label: "Total Expenses",
        value: formatCurrency(totalExpenses),
        desc: "Total operating costs",
        icon: Wallet,
        color: "#C62026",
        rawValue: totalExpenses,
      },
      {
        label: "Net Profit",
        value: formatCurrency(netProfit),
        desc: "Bottom-line earnings",
        icon: TrendingUp,
        color: "#00648F",
        rawValue: netProfit,
      },
      {
        label: "Total Assets",
        value: formatCurrency(totalAssets),
        desc: "Company's total valuation",
        icon: Building2,
        color: "#8bc53d",
        rawValue: totalAssets,
      },
      {
        label: "Total Liabilities",
        value: formatCurrency(totalLiabilities),
        desc: "Current total obligations",
        icon: CreditCard,
        color: "#F68C1F",
        rawValue: totalLiabilities,
      },
      {
        label: "Total Equity",
        value: formatCurrency(totalEquity),
        desc: "Net asset value",
        icon: Scale,
        color: "#00648F",
        rawValue: totalEquity,
      },
      {
        label: "Working Capital",
        value: formatCurrency(workingCapital),
        desc: "Available operating liquidity",
        icon: RefreshCw,
        color: "#8bc53d",
        rawValue: workingCapital,
      },
      {
        label: "Cash & Bank Balance",
        value: formatCurrency(cashBank),
        desc: "Liquid funds available",
        icon: PiggyBank,
        color: "#8bc53d",
        rawValue: cashBank,
      },
      {
        label: "Account Receivable",
        value: formatCurrency(accountsReceivable),
        desc: "Unpaid client invoices",
        icon: ArrowDownToLine,
        color: "#00B0F0",
        rawValue: accountsReceivable,
      },
      {
        label: "Inventory Value",
        value: formatCurrency(inventoryValue),
        desc: "Current stock valuation",
        icon: Package,
        color: "#6D6E71",
        rawValue: inventoryValue,
      },
      {
        label: "Account Payable",
        value: formatCurrency(accountsPayable),
        desc: "Outstanding vendor bills",
        icon: ArrowUpFromLine,
        color: "#C62026",
        rawValue: accountsPayable,
      },
      {
        label: "Long-Term Debt",
        value: formatCurrency(longTermDebt),
        desc: "Non-current liabilities",
        icon: Landmark,
        color: "#C62026",
        rawValue: longTermDebt,
      },
    ];
  } catch (error) {
    console.error("Error fetching dashboard KPIs:", error);
    throw error;
  }
}

// ─── FINANCIAL TRENDS ────────────────────────────────────────────────────────
// Fetches the P&L API once per month in the range so every bar in the chart
// reflects the real data for that month rather than a rough distribution.

async function fetchMonthRevExp(
  year: number,
  month: number, // 0-indexed (0 = Jan)
): Promise<{ revenue: number; expenses: number }> {
  const pad = (n: number) => String(n).padStart(2, "0");
  const lastDay = new Date(year, month + 1, 0).getDate();

  const startDate = `${year}-${pad(month + 1)}-01`;
  const endDate = `${year}-${pad(month + 1)}-${pad(lastDay)}`;

  const endpoint = `/profit-and-loss-statement?start_date=${startDate}&end_date=${endDate}`;
  console.log("[fetchMonthRevExp] →", endpoint);

  try {
    const json = await fetchWithAuth(endpoint);
    const rows = json?.data?.Rows?.Row || json?.Rows?.Row || [];
    return extractRevenueAndExpenses(rows);
  } catch (err) {
    console.error("[fetchMonthRevExp] Error:", err);
    return { revenue: 0, expenses: 0 };
  }
}

/** Build an array of { year, month0 } for every month in [startDate, endDate] */
function buildMonthRange(
  startDate: string,
  endDate: string,
): Array<{ year: number; month: number }> {
  const start = new Date(startDate + "T00:00:00");
  const end = new Date(endDate + "T00:00:00");

  const months: Array<{ year: number; month: number }> = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);

  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() });
    cur.setMonth(cur.getMonth() + 1);
  }
  return months;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * Fetch financial trends (real data, one API call per month).
 * For "quarterly" aggregation the monthly values are summed into quarters.
 */
export async function fetchFinancialTrends(
  startDate?: string,
  endDate?: string,
  aggregationType: "monthly" | "quarterly" = "monthly",
): Promise<Array<{ name: string; revenue: number; expenses: number }>> {
  const baseUrl = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");

  // Build query params — backend expects start_date / end_date (snake_case)
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  const qs = params.toString() ? `?${params.toString()}` : "";
  const url = `${baseUrl}/profit-and-loss${qs}`;
  // Default: last 6 months if no range provided
  const now = new Date();
  const resolvedEnd =
    endDate ||
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const resolvedStart =
    startDate ||
    `${sixMonthsAgo.getFullYear()}-${String(sixMonthsAgo.getMonth() + 1).padStart(2, "0")}-01`;

  const monthRange = buildMonthRange(resolvedStart, resolvedEnd);

  const results = [];
  // Use sequential fetching to avoid 429 Rate Limits from QuickBooks backend
  for (const { year, month } of monthRange) {
    const data = await fetchMonthRevExp(year, month);
    results.push({ year, month, ...data });
    // Small delay to be gentle on the API
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  if (aggregationType === "monthly") {
    return results.map(({ year, month, revenue, expenses }) => ({
      name: `${SHORT_MONTHS[month]} ${year}`,
      revenue,
      expenses,
    }));
  }

  const quarterMap = new Map<string, { revenue: number; expenses: number }>();

  for (const { year, month, revenue, expenses } of results) {
    const q = Math.floor(month / 3) + 1;
    const key = `Q${q} ${year}`;
    const existing = quarterMap.get(key) ?? { revenue: 0, expenses: 0 };
    quarterMap.set(key, {
      revenue: existing.revenue + revenue,
      expenses: existing.expenses + expenses,
    });
  }

  return Array.from(quarterMap.entries()).map(([name, data]) => ({
    name,
    ...data,
  }));
}

