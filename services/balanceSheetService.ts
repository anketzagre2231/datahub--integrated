import { fetchWithAuth } from "./apiService";
import { normalizeReportData } from "./reportService";
import { AccountDetail, DetailedFinancialData, FinancialGroup, Transaction } from "@/types/financial-details";
import { FinancialLine } from "@/types/balance-sheet";

function toRows(value: unknown): any[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return [value];
  return [];
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
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getReportFallbackDate(report: any): string {
  const header = report?.Header;

  if (typeof header?.EndPeriod === "string" && header.EndPeriod.trim()) {
    return header.EndPeriod;
  }

  if (typeof header?.StartPeriod === "string" && header.StartPeriod.trim()) {
    return header.StartPeriod;
  }

  if (typeof header?.ReportDate === "string" && header.ReportDate.trim()) {
    return header.ReportDate;
  }

  if (typeof header?.Time === "string" && header.Time.trim()) {
    return header.Time.slice(0, 10);
  }

  return "N/A";
}

function buildMemoFromColumns(columnTitles: string[], values: string[]) {
  const memoParts = columnTitles
    .map((title, index) => ({ title, value: values[index] || "" }))
    .filter(({ title, value }) => {
      const key = normalizeKey(title);
      if (!value) return false;
      return !["date", "transactiontype", "num", "amount", "balance", "openbalance", "account", "customer", "vendor", "name"].includes(key);
    })
    .map(({ title, value }) => `${title}: ${value}`);

  return memoParts.join(" | ");
}

function rowToTransaction(
  row: any,
  columnTitles: string[],
  reportDate: string,
  fallbackName: string,
  reportName: string,
  pathKey: string
): Transaction | null {
  const colData = Array.isArray(row?.ColData) ? row.ColData : [];
  if (colData.length === 0) return null;

  const values = colData.map((col: any) => String(col?.value ?? ""));
  const lookup = Object.fromEntries(columnTitles.map((title, index) => [normalizeKey(title), values[index] || ""]));
  const numericValues = values.filter((value: string) => value && !Number.isNaN(parseFloat(value.replace(/[^0-9.-]/g, ""))));

  const amountRaw =
    lookup.amount ||
    lookup.total ||
    lookup.debit ||
    lookup.credit ||
    lookup.openbalance ||
    lookup.balance ||
    numericValues[numericValues.length - 1] ||
    "0";

  const balanceRaw =
    lookup.balance ||
    lookup.openbalance ||
    lookup.total ||
    amountRaw;

  const name =
    lookup.account ||
    lookup.customer ||
    lookup.vendor ||
    lookup.name ||
    values[0] ||
    fallbackName;

  return {
    id: String(colData[0]?.id ?? `${reportName}-${fallbackName}-${values.join("-")}`) + `-${pathKey}`,
    date: lookup.date || reportDate,
    type: lookup.transactiontype || lookup.type || reportName,
    num: lookup.num || "",
    name,
    memo: buildMemoFromColumns(columnTitles, values),
    split: lookup.split || lookup.detailtype || lookup.accounttype || "",
    amount: toNumber(amountRaw),
    balance: toNumber(balanceRaw) || toNumber(amountRaw),
  };
}

function collectTransactionsFromRows(
  rows: any[],
  columnTitles: string[],
  reportDate: string,
  fallbackName: string,
  reportName: string,
  parentPath = "root"
): Transaction[] {
  const transactions: Transaction[] = [];

  rows.forEach((row, index) => {
    const type = row?.type?.toLowerCase();
    const pathKey = `${parentPath}-data-${index}`;

    if (type === "data") {
      const transaction = rowToTransaction(row, columnTitles, reportDate, fallbackName, reportName, pathKey);
      if (transaction) transactions.push(transaction);
      return;
    }

    const nestedRows = toRows(row?.Rows?.Row);
    if (nestedRows.length > 0) {
      transactions.push(
        ...collectTransactionsFromRows(
          nestedRows,
          columnTitles,
          reportDate,
          fallbackName,
          reportName,
          `${parentPath}-section-${index}`
        )
      );
    }
  });

  return transactions;
}

function collectAccountsFromRows(
  rows: any[],
  columnTitles: string[],
  reportDate: string,
  reportName: string,
  parentPath = "root"
): AccountDetail[] {
  const accounts: AccountDetail[] = [];

  rows.forEach((row, index) => {
    const type = row?.type?.toLowerCase();
    const pathKey = `${parentPath}-${type || "row"}-${index}`;

    if (type === "section") {
      const accountName =
        row?.Header?.ColData?.[0]?.value ||
        row?.Summary?.ColData?.[0]?.value ||
        `${reportName} Section ${index + 1}`;

      const nestedRows = toRows(row?.Rows?.Row);
      const transactions = collectTransactionsFromRows(
        nestedRows,
        columnTitles,
        reportDate,
        accountName,
        reportName,
        pathKey
      );

      const summaryCols = Array.isArray(row?.Summary?.ColData) ? row.Summary.ColData : [];
      const lastSummaryCol = summaryCols.length > 0 ? summaryCols[summaryCols.length - 1] : undefined;
      const summaryAmount = toNumber(lastSummaryCol?.value);

      if (transactions.length > 0 || summaryAmount !== 0) {
        accounts.push({
          id: String(row?.group ?? row?.id ?? `${reportName}-account-${index}`) + `-${pathKey}`,
          name: accountName,
          total: summaryAmount || transactions.reduce((sum, tx) => sum + tx.amount, 0),
          transactions: transactions.length > 0
            ? transactions
            : [
                {
                  id: `${reportName}-summary-${index}`,
                  date: reportDate,
                  type: reportName,
                  num: "",
                  name: accountName,
                  memo: "Summary row",
                  split: "",
                  amount: summaryAmount,
                  balance: summaryAmount,
                },
              ],
        });
      }

      if (nestedRows.length > 0) {
        accounts.push(...collectAccountsFromRows(nestedRows, columnTitles, reportDate, reportName, pathKey));
      }

      return;
    }

    if (type === "data") {
      const transaction = rowToTransaction(row, columnTitles, reportDate, reportName, reportName, pathKey);
      if (!transaction) return;

      accounts.push({
        id: `${reportName}-data-${index}-${pathKey}`,
        name: transaction.name,
        total: transaction.amount,
        transactions: [transaction],
      });
    }
  });

  return accounts;
}

function convertAllReportsToDetailedData(payload: any): DetailedFinancialData {
  const groups: FinancialGroup[] = Object.entries(payload || {})
    .flatMap(([key, report]: [string, any], index) => {
      if (!report || report.error || !report.Rows || !report.Columns) {
        return [];
      }

      const reportName = report?.Header?.ReportName || key;
      const reportDate = getReportFallbackDate(report);
      const columnTitles = (report?.Columns?.Column || []).map((column: any) => String(column?.ColTitle || ""));
      const rows = toRows(report?.Rows?.Row);
      const accounts = collectAccountsFromRows(rows, columnTitles, reportDate, reportName);

      if (accounts.length === 0) {
        return [];
      }

      const groupTotal = accounts.reduce((sum, account) => sum + account.total, 0);

      return [{
        id: `${key}-${index}`,
        name: reportName,
        total: groupTotal,
        accounts,
      }];
    });

  return {
    groups,
    grandTotal: groups.reduce((sum, group) => sum + group.total, 0),
  };
}

export async function getBalanceSheet(
  startDate?: string,
  endDate?: string,
  accountingMethod?: string
): Promise<FinancialLine[]> {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (accountingMethod) params.set("accounting_method", accountingMethod);
    if (accountingMethod) params.set("basis", accountingMethod);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const json = await fetchWithAuth(`/balance-sheet${qs}`);
    console.log("[Balance Sheet][Summary] API response:", json);
    const normalized = normalizeReportData("Balance Sheet", "summary", json) as FinancialLine[];
    console.log("[Balance Sheet][Summary] Normalized output:", normalized);
    return normalized;
  } catch (err) {
    console.warn("Returning empty Balance Sheet due to error:", err);
    return [];
  }
}

export async function getBalanceSheetDetail(
  startDate?: string,
  endDate?: string,
  accountingMethod?: string
): Promise<DetailedFinancialData> {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set("start_date", startDate);
    if (endDate) params.set("end_date", endDate);
    if (accountingMethod) params.set("accounting_method", accountingMethod);
    if (accountingMethod) params.set("basis", accountingMethod);
    const qs = params.toString() ? `?${params.toString()}` : "";

    const json = await fetchWithAuth(`/all-reports${qs}`);

    console.log("[Balance Sheet][Detail] /all-reports API response:", json);
    const normalized = convertAllReportsToDetailedData(json);
    console.log("[Balance Sheet][Detail] Normalized output:", normalized);
    return normalized;
  } catch (err) {
    console.warn("Returning empty Balance Sheet Detail due to error:", err);
    return { groups: [] };
  }
}

