/**
 * Advanced report utility to flatten multiple QuickBooks JSON reports into dynamic tabular formats.
 */

export interface ExcelWorkbookData {
  [sheetName: string]: any[];
}

/**
 * Flattens all reports found in a JSON response. 
 * Handles both multi-report objects (from /all-reports) 
 * and single-report objects (from /profit-and-loss-statement).
 * 
 * @param rawJson The API response (single or multi-report)
 * @param reportKeyHint (Optional) The active tab name to prioritize (e.g. 'profitandloss')
 */
export function flattenAllReports(rawJson: any, reportKeyHint?: string): ExcelWorkbookData {
  const workbookData: ExcelWorkbookData = {};

  // 1. Check if the rawJson IS a single report itself (direct Header/Rows/Columns)
  if (rawJson && rawJson.Rows && rawJson.Columns) {
    const reportName = rawJson.Header?.ReportName || "Report";
    const data = processSingleReport(rawJson);
    if (data.length > 0) {
      workbookData[reportName] = data;
    }
    return workbookData;
  }

  // 2. Otherwise, treat as multi-report object (e.g. { balanceSheet: {...}, profitLoss: {...} })
  const hintTerms = reportKeyHint 
    ? reportKeyHint.toLowerCase().split(/[^a-z0-9]/).filter(t => t.length > 2)
    : [];

  const keys = Object.keys(rawJson).sort((a, b) => {
    if (hintTerms.length > 0) {
      const aLower = a.toLowerCase();
      const bLower = b.toLowerCase();
      const aScore = hintTerms.reduce((score, term) => score + (aLower.includes(term) ? 1 : 0), 0);
      const bScore = hintTerms.reduce((score, term) => score + (bLower.includes(term) ? 1 : 0), 0);
      return bScore - aScore;
    }
    return 0;
  });

  keys.forEach((key) => {
    const report = rawJson[key];
    if (report && report.Rows && report.Columns) {
      const reportName = report.Header?.ReportName || key;
      const data = processSingleReport(report);
      if (data.length > 0) {
        workbookData[reportName] = data;
      }
    }
  });

  return workbookData;
}

/**
 * Core processing logic for a single QuickBooks report structure.
 */
function processSingleReport(report: any): any[] {
  const columnTitles = report.Columns.Column.map((col: any) => col.ColTitle || "Value");
  const flattenedRows: any[] = [];
  const rows = report.Rows.Row || [];

  function traverseRows(rowsList: any[], context: { section: string; subSection: string }) {
    rowsList.forEach((row: any) => {
      // Handle Sections
      if (row.type === "Section") {
        const title = row.Header?.ColData?.[0]?.value || "";
        const nextContext = { ...context };
        
        if (!context.section) {
          nextContext.section = title;
        } else {
          nextContext.subSection = context.subSection 
            ? `${context.subSection} > ${title}` 
            : title;
        }

        if (row.Rows?.Row) {
          traverseRows(row.Rows.Row, nextContext);
        }
      } 
      // Handle Data Rows
      else if (row.type === "Data") {
        const colData = row.ColData || [];
        const rowData: any = {
          "Section": context.section,
          "Sub Section": context.subSection
        };

        columnTitles.forEach((title: string, index: number) => {
          const colName = title || `Col_${index + 1}`;
          rowData[colName] = colData[index]?.value || "";
        });

        flattenedRows.push(rowData);
      }
    });
  }

  traverseRows(rows, { section: "", subSection: "" });
  return flattenedRows;
}
