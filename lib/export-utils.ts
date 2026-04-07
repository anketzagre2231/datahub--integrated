import { FinancialLine } from "@/types/balance-sheet";
import { DetailedFinancialData } from "@/types/financial-details";
import { formatCurrency } from "./utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ── FLATTENING LOGIC ───────────────────────────────────────────────────────────

/**
 * Traverses a summary report structure (FinancialLine[]) and returns a flat array
 * for tabular consumption.
 */
export function flattenSummaryData(data: FinancialLine[], depth = 0): any[] {
  const result: any[] = [];

  data.forEach((line) => {
    // Generate label with indentation
    const indent = "  ".repeat(depth);
    const label = `${indent}${line.name}`;

    result.push({
      "Accounting Classification": label,
      "Amount (USD)": line.amount,
      _isTotal: line.type === "total",
      _isHeader: line.type === "header",
      _depth: depth,
    });

    if (line.children && line.children.length > 0) {
      result.push(...flattenSummaryData(line.children, depth + 1));
    }
  });

  return result;
}

/**
 * Flattens detailed transactional data into a single array.
 */
export function flattenDetailData(data: DetailedFinancialData): any[] {
  const result: any[] = [];

  if (!data?.groups) return [];

  data.groups.forEach((group) => {
    // 1. Group Header
    result.push({
      "Date": group.name.toUpperCase(),
      "Type": "",
      "Num": "",
      "Name": "",
      "Memo": "",
      "Split": "",
      "Amount": null,
      "Balance": null,
      _isHeader: true,
      _isGroup: true,
    });

    group.accounts.forEach((account) => {
      // 2. Account Header
      result.push({
        "Date": `  ${account.name}`,
        "Type": "",
        "Num": "",
        "Name": "",
        "Memo": "",
        "Split": "",
        "Amount": null,
        "Balance": null,
        _isHeader: true,
        _isAccount: true,
      });

      // 3. Transactions
      account.transactions.forEach((tx) => {
        result.push({
          "Date": tx.date,
          "Type": tx.type,
          "Num": tx.num,
          "Name": tx.name,
          "Memo": tx.memo,
          "Split": tx.split,
          "Amount": tx.amount,
          "Balance": tx.balance,
        });
      });

      // 4. Account Total
      result.push({
        "Date": "",
        "Type": "",
        "Num": "",
        "Name": "",
        "Memo": `Total for ${account.name}`,
        "Split": "",
        "Amount": account.total,
        "Balance": null,
        _isTotal: true,
        _isAccount: true,
      });
    });

    // 5. Group Total
    result.push({
      "Date": "",
      "Type": "",
      "Num": "",
      "Name": "",
      "Memo": `Total for ${group.name}`,
      "Split": "",
      "Amount": group.total,
      "Balance": null,
      _isTotal: true,
      _isGroup: true,
    });
  });

  return result;
}

// ── EXCEL GENERATION ──────────────────────────────────────────────────────────

export function exportToExcel(
  title: string,
  subtitle: string,
  data: any[],
  fileName: string
) {
  // Map data to clean version without internal tracking fields
  const excelData = data.map((row) => {
    const cleanRow: any = {};
    Object.keys(row).forEach((key) => {
      if (!key.startsWith("_")) {
        const val = row[key];
        // Ensure numbers are formatted or stay as numbers for Excel?
        // Usually, better to keep as numbers and let Excel format, or stringify for predictability.
        // We will stringify numbers to match UI (USD) if they represent totals.
        if (typeof val === "number") {
          cleanRow[key] = val; // Keep as number for sorting/math in Excel
        } else {
          cleanRow[key] = val || "-";
        }
      }
    });
    return cleanRow;
  });

  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = Object.keys(excelData[0] || {}).map((key) => ({
    wch: key === "Date" || key === "Accounting Classification" ? 40 : 15,
  }));
  worksheet["!cols"] = columnWidths;

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Financial Data");
  XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

// ── PDF GENERATION ────────────────────────────────────────────────────────────

export function exportToPDF(
  title: string,
  subtitle: string,
  headers: string[],
  data: any[],
  fileName: string
) {
  const doc = new jsPDF("l", "pt", "a4"); // Landscape for wider detail tables

  // Title section
  doc.setFontSize(18);
  doc.setTextColor(40);
  doc.text("Sage Healthy RCM, LLC", doc.internal.pageSize.getWidth() / 2, 40, { align: "center" });
  
  doc.setFontSize(14);
  doc.text(title, doc.internal.pageSize.getWidth() / 2, 65, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(subtitle, doc.internal.pageSize.getWidth() / 2, 85, { align: "center" });

  const body = data.map((row) =>
    headers.map((h) => {
      const val = row[h];
      if (typeof val === "number" && (h.includes("Amount") || h.includes("Balance") || h.includes("Total"))) {
        return formatCurrency(val);
      }
      return val === null ? "" : String(val);
    })
  );

  autoTable(doc, {
    head: [headers],
    body: body,
    startY: 110,
    theme: "grid",
    styles: { fontSize: 8, cellPadding: 4, font: "helvetica" },
    headStyles: { fillColor: [15, 23, 42], textColor: 255, halign: "center", fontStyle: "bold" },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    
    didParseCell: (data) => {
      const rowData = data.row.raw as any[];
      const rowIndex = data.row.index;
      const rawRow = data.row.raw;
      const internalRow = data.table.body[rowIndex].raw as any; // This won't work easily

      // Use column styling for numbers
      const colIndex = data.column.index;
      const header = headers[colIndex];
      if (header.includes("Amount") || header.includes("Balance")) {
        data.cell.styles.halign = "right";
      }

      // Check if this row in the source data was a header or total
      const sourceRow = data.row.raw as any;
      // We need to bake styles into the data mapping or use index mapping
    },
    
    // Applying visual hierarchy
    willDrawCell: (cellData) => {
      if (cellData.section !== "body") return;

      const rowIndex = cellData.row.index;
      const originalRow = data[rowIndex];

      if (!originalRow) return;

      if (originalRow._isHeader) {
        doc.setFont("helvetica", "bold");
        cellData.cell.styles.fillColor = [241, 245, 249];
        cellData.cell.styles.textColor = [15, 23, 42];
      }
      if (originalRow._isTotal) {
        doc.setFont("helvetica", "bold");
        cellData.cell.styles.fillColor = [236, 252, 247]; 
      }
    },
    margin: { left: 40, right: 40 },
    columnStyles: {
      0: { cellWidth: "auto" },
    }
  });

  // Footer / Page numbers
  const pageCount = doc.internal.pages.length - 1;
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.getWidth() / 2, doc.internal.pageSize.getHeight() - 20, { align: "center" });
  }

  doc.save(`${fileName}.pdf`);
}
