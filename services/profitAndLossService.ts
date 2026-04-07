import { fetchWithAuth } from "./apiService";
import { DetailedFinancialData, FinancialGroup, AccountDetail, Transaction } from "@/types/financial-details";
import { FinancialLine } from "@/types/balance-sheet";

interface QuickBooksValue {
  value?: string;
  id?: string;
}

interface QuickBooksRow {
  type?: string;
  id?: string;
  group?: string;
  Header?: { ColData?: QuickBooksValue[] };
  Summary?: { ColData?: QuickBooksValue[] };
  ColData?: QuickBooksValue[];
  Rows?: { Row?: QuickBooksRow[] };
}

interface QuickBooksColumn {
  ColTitle?: string;
  ColType?: string;
  MetaData?: Array<{
    Name?: string;
    Value?: string;
  }>;
}

interface QuickBooksReportBody {
  Header?: {
    EndPeriod?: string;
    ReportDate?: string;
    Time?: string;
  };
  Columns?: { Column?: QuickBooksColumn[] };
  Rows?: { Row?: QuickBooksRow[] };
}

interface QuickBooksApiResponse {
  data?: QuickBooksReportBody;
  Header?: QuickBooksReportBody["Header"];
  Columns?: QuickBooksReportBody["Columns"];
  Rows?: QuickBooksReportBody["Rows"];
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (value === undefined || value === null) return [];
  return [value as T];
}

function getRoot(apiData: QuickBooksApiResponse | QuickBooksReportBody | null | undefined): QuickBooksReportBody {
  if (!apiData) return {};

  const response = apiData as QuickBooksApiResponse;
  return response.data ?? (apiData as QuickBooksReportBody);
}

function getRows(apiData: QuickBooksApiResponse | QuickBooksReportBody | null | undefined): QuickBooksRow[] {
  return asArray<QuickBooksRow>(getRoot(apiData)?.Rows?.Row);
}

interface ColumnDescriptor {
  title: string;
  key: string;
}

function getColumnDescriptors(apiData: QuickBooksApiResponse | QuickBooksReportBody | null | undefined): ColumnDescriptor[] {
  return asArray<QuickBooksColumn>(getRoot(apiData)?.Columns?.Column).map((column) => {
    const metaKey = column?.MetaData?.find((meta) => meta?.Name === "ColKey")?.Value || "";
    return {
      title: String(column?.ColTitle ?? ""),
      key: String((metaKey || column?.ColTitle) ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "_"),
    };
  });
}

function getReportDate(apiData: QuickBooksApiResponse | QuickBooksReportBody | null | undefined) {
  const header = getRoot(apiData)?.Header;
  return String(header?.EndPeriod || header?.ReportDate || header?.Time?.slice(0, 10) || "N/A");
}

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
  if (typeof value !== "string") return 0;

  const trimmed = value.trim();
  if (!trimmed) return 0;

  const negativeByParens = trimmed.includes("(") && trimmed.includes(")");
  const numeric = parseFloat(trimmed.replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(numeric)) return 0;

  return negativeByParens ? -Math.abs(numeric) : numeric;
}

function getLastNumericValue(cols: QuickBooksValue[] | undefined): string {
  const values = Array.isArray(cols) ? cols : [];

  for (let index = values.length - 1; index >= 0; index -= 1) {
    const raw = values[index]?.value;
    if (raw === undefined || raw === null) continue;
    if (String(raw).trim() === "") continue;
    if (Number.isFinite(toNumber(raw))) return String(raw);
  }

  return "";
}

function getRowName(row: QuickBooksRow, fallback = "Unnamed Item"): string {
  return String(
    row?.Header?.ColData?.[0]?.value ||
      row?.Summary?.ColData?.[0]?.value ||
      row?.ColData?.[0]?.value ||
      row?.Header?.ColData?.[1]?.value ||
      row?.Summary?.ColData?.[1]?.value ||
      fallback
  );
}

function getRowAmount(row: QuickBooksRow): number {
  const summaryAmount = getLastNumericValue(row?.Summary?.ColData);
  if (summaryAmount) return toNumber(summaryAmount);

  const directAmount = getLastNumericValue(row?.ColData);
  if (directAmount) return toNumber(directAmount);

  return 0;
}

function isSectionRow(row: QuickBooksRow) {
  return String(row?.type || "").toLowerCase() === "section";
}

function isDataRow(row: QuickBooksRow) {
  return String(row?.type || "").toLowerCase() === "data";
}

function isTotalLike(name: string) {
  const normalized = name.toLowerCase();
  return (
    normalized.startsWith("total ") ||
    normalized.includes("gross profit") ||
    normalized.includes("net operating income") ||
    normalized.includes("net other income") ||
    normalized.includes("net income")
  );
}

function cleanReportName(name: string) {
  return name.replace(/^Total\s+for\s+/i, "").replace(/^Total\s+/i, "");
}

function parseSummaryRow(row: QuickBooksRow, index: number): FinancialLine | null {
  if (!row) return null;

  const children = asArray<QuickBooksRow>(row?.Rows?.Row)
    .map((child, childIndex) => parseSummaryRow(child, childIndex))
    .filter(Boolean) as FinancialLine[];

  const name = cleanReportName(getRowName(row, `Row ${index + 1}`));
  const amount = getRowAmount(row);

  if (isDataRow(row)) {
    return {
      id: String(row?.id || row?.group || createStableId("pl-data", name, index)),
      name,
      amount,
      type: "data",
    };
  }

  if (children.length > 0) {
    return {
      id: String(row?.id || row?.group || createStableId("pl-section", name, index)),
      name,
      amount,
      type: "header",
      children,
    };
  }

  return {
    id: String(row?.id || row?.group || createStableId("pl-total", name, index)),
    name,
    amount,
    type: isTotalLike(name) ? "total" : "total",
  };
}

function parseSummaryReport(apiData: QuickBooksApiResponse | QuickBooksReportBody): FinancialLine[] {
  return getRows(apiData)
    .map((row, index) => parseSummaryRow(row, index))
    .filter(Boolean) as FinancialLine[];
}

function buildTransaction(
  colData: QuickBooksValue[] | undefined,
  columnDescriptors: ColumnDescriptor[],
  reportDate: string,
  fallbackName: string,
  fallbackType: string,
  fallbackId: string
): Transaction | null {
  if (!Array.isArray(colData) || colData.length === 0) return null;

  const values = colData.map((col) => String(col?.value ?? ""));
  const lookup = Object.fromEntries(
    columnDescriptors.map((descriptor, index) => [descriptor.key, values[index] || ""])
  ) as Record<string, string>;

  const amountRaw =
    lookup.subt_nat_amount ||
    lookup.amount ||
    lookup.balance ||
    values[values.length - 2] ||
    values[values.length - 1] ||
    "0";

  const balanceRaw = lookup.rbal_nat_amount || lookup.balance || amountRaw;

  const typeValue =
    lookup.txn_type ||
    lookup.transactiontype ||
    lookup.type ||
    fallbackType;

  const name =
    lookup.name ||
    lookup.customer ||
    lookup.vendor ||
    lookup.account ||
    values[3] ||
    values[1] ||
    fallbackName;

  const memo = values.length >= 5 ? values[4] : "";
  const split = values.length >= 6 ? values[5] : "";

  return {
    id: String(colData[0]?.id || fallbackId),
    date: values[0] || reportDate,
    type: typeValue,
    num: values[2] || "",
    name,
    memo,
    split,
    amount: toNumber(amountRaw),
    balance: toNumber(balanceRaw) || toNumber(amountRaw),
  };
}

function collectTransactionsFromRow(
  row: QuickBooksRow,
  columnDescriptors: ColumnDescriptor[],
  reportDate: string,
  fallbackName: string,
  fallbackType: string,
  pathKey: string
): Transaction[] {
  const transactions: Transaction[] = [];
  const directRows = asArray<QuickBooksRow>(row?.Rows?.Row).filter(isDataRow);

  for (let index = 0; index < directRows.length; index += 1) {
    const tx = buildTransaction(
      directRows[index]?.ColData,
      columnDescriptors,
      reportDate,
      fallbackName,
      fallbackType,
      `${pathKey}-tx-${index}`
    );
    if (tx) transactions.push(tx);
  }

  return transactions;
}

function collectAccountsFromSection(
  row: QuickBooksRow,
  columnDescriptors: ColumnDescriptor[],
  reportDate: string,
  fallbackType: string,
  pathKey: string
): AccountDetail[] {
  const accounts: AccountDetail[] = [];

  if (!isSectionRow(row)) {
    return accounts;
  }

  const childRows = asArray<QuickBooksRow>(row?.Rows?.Row);
  const directTransactions = collectTransactionsFromRow(
    row,
    columnDescriptors,
    reportDate,
    cleanReportName(getRowName(row, "Account")),
    fallbackType,
    pathKey
  );

  if (directTransactions.length > 0) {
    const accountName = cleanReportName(getRowName(row, "Account"));
    const total = getRowAmount(row) || directTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    accounts.push({
      id: String(row?.id || row?.group || createStableId("pl-account", accountName, pathKey)),
      name: accountName,
      total,
      transactions: directTransactions,
    });
  }

  childRows
    .filter(isSectionRow)
    .forEach((childRow, index) => {
      accounts.push(...collectAccountsFromSection(childRow, columnDescriptors, reportDate, fallbackType, `${pathKey}-${index}`));
    });

  return accounts;
}

function collectAccountsFromGroupRows(
  rows: QuickBooksRow[],
  columnDescriptors: ColumnDescriptor[],
  reportDate: string,
  fallbackType: string,
  parentPath = "root"
): AccountDetail[] {
  const accounts: AccountDetail[] = [];

  rows.forEach((row, index) => {
    const pathKey = `${parentPath}-${index}`;

    if (isDataRow(row)) {
      const tx = buildTransaction(
        row?.ColData,
        columnDescriptors,
        reportDate,
        cleanReportName(getRowName(row, `Transaction ${index + 1}`)),
        fallbackType,
        `${pathKey}-data`
      );

      if (tx) {
        accounts.push({
          id: String(row?.id || createStableId("pl-account", tx.name, index)),
          name: tx.name,
          total: tx.amount,
          transactions: [tx],
        });
      }

      return;
    }

    if (isSectionRow(row)) {
      accounts.push(...collectAccountsFromSection(row, columnDescriptors, reportDate, fallbackType, pathKey));
    }
  });

  return accounts;
}

function parseDetailGroup(
  row: QuickBooksRow,
  columnDescriptors: ColumnDescriptor[],
  reportDate: string,
  fallbackType: string,
  index: number,
  parentPath = "root"
): FinancialGroup | null {
  if (!isSectionRow(row)) return null;

  const name = cleanReportName(getRowName(row, `Group ${index + 1}`));
  const rows = asArray<QuickBooksRow>(row?.Rows?.Row);
  const accounts = collectAccountsFromGroupRows(rows, columnDescriptors, reportDate, fallbackType, `${parentPath}-${index}`);

  if (accounts.length === 0) {
    return null;
  }

  const total = getRowAmount(row) || accounts.reduce((sum, account) => sum + account.total, 0);

  return {
    id: String(row?.id || row?.group || createStableId("pl-group", name, index)),
    name,
    total,
    accounts,
  };
}

function parseDetailReport(apiData: QuickBooksApiResponse | QuickBooksReportBody): DetailedFinancialData {
  const rootRows = getRows(apiData);
  const columnDescriptors = getColumnDescriptors(apiData);
  const reportDate = getReportDate(apiData);

  const groups: FinancialGroup[] = [];

  rootRows.forEach((row, index) => {
    if (!isSectionRow(row)) {
      return;
    }

    const group = parseDetailGroup(row, columnDescriptors, reportDate, cleanReportName(getRowName(row)), index);
    if (group) {
      groups.push(group);
      return;
    }

    const nestedGroups = asArray<QuickBooksRow>(row?.Rows?.Row)
      .map((child, childIndex) => parseDetailGroup(child, columnDescriptors, reportDate, cleanReportName(getRowName(row)), childIndex, `${index}`))
      .filter(Boolean) as FinancialGroup[];

    groups.push(...nestedGroups);
  });

  const dedupedGroups = groups.filter(
    (group, index, self) =>
      index === self.findIndex((candidate) => candidate.name === group.name && candidate.accounts.length === group.accounts.length)
  );

  return {
    groups: dedupedGroups,
    grandTotal: dedupedGroups.reduce((sum, group) => sum + group.total, 0),
  };
}

function buildQueryString(startDate?: string, endDate?: string, accountingMethod?: string) {
  const params = new URLSearchParams();
  if (startDate) params.set("start_date", startDate);
  if (endDate) params.set("end_date", endDate);
  if (accountingMethod) params.set("accounting_method", accountingMethod);
  if (accountingMethod) params.set("basis", accountingMethod);
  return params.toString() ? `?${params.toString()}` : "";
}

export async function getProfitAndLoss(
  startDate?: string,
  endDate?: string,
  accountingMethod?: string
): Promise<FinancialLine[]> {
  try {
    const qs = buildQueryString(startDate, endDate, accountingMethod);
    const json = await fetchWithAuth(`/profit-and-loss-statement${qs}`);
    console.log("[Profit & Loss][Summary] API response:", json);
    const parsed = parseSummaryReport(json);
    console.log("[Profit & Loss][Summary] Parsed output:", parsed);
    return parsed;
  } catch (err) {
    console.warn("Returning empty P&L due to error:", err);
    return [];
  }
}

export async function getProfitAndLossDetail(
  startDate?: string,
  endDate?: string,
  accountingMethod?: string
): Promise<DetailedFinancialData> {
  try {
    const qs = buildQueryString(startDate, endDate, accountingMethod);
    const json = await fetchWithAuth(`/profit-and-loss-detail${qs}`);
    console.log("[Profit & Loss][Detail] API response:", json);
    const parsed = parseDetailReport(json);
    console.log("[Profit & Loss][Detail] Parsed output:", parsed);
    return parsed;
  } catch (err) {
    console.warn("Returning empty P&L Detail due to error:", err);
    return { groups: [] };
  }
}

export async function getProfitAndLossStatement(): Promise<FinancialLine[]> {
  try {
    const json = await fetchWithAuth("/profit-and-loss-statement");
    console.log("[Profit & Loss][Statement] API response:", json);
    const parsed = parseSummaryReport(json);
    console.log("[Profit & Loss][Statement] Parsed output:", parsed);
    return parsed;
  } catch (err) {
    console.warn("Returning empty P&L Statement due to error:", err);
    return [];
  }
}

