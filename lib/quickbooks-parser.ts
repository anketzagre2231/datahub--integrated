import { FinancialLine } from "@/types/balance-sheet";
import { DetailedFinancialData, AccountDetail, Transaction } from "@/types/financial-details";
import { Invoice } from "@/types/invoices";
import { Customer } from "@/types/customers";

export function parseQBBalanceSheet(qbData: any): FinancialLine[] {
  const root = qbData.data ? qbData.data : qbData;
  if (!root || !root.Rows || !root.Rows.Row) return [];

  const parseRow = (row: any, level: number): FinancialLine | null => {
    if (row.type === "Section") {
      const name = row.Header?.ColData?.[0]?.value || "";
      const totalCol = row.Summary?.ColData?.[row.Summary.ColData.length - 1]?.value;
      const amount = totalCol ? parseFloat(totalCol) : 0;

      const children: FinancialLine[] = [];
      if (row.Rows && row.Rows.Row) {
        for (const subRow of row.Rows.Row) {
          const parsedSub = parseRow(subRow, level + 1);
          if (parsedSub) {
            children.push(parsedSub);
          }
        }
      }

      const totalName = row.Summary?.ColData?.[0]?.value || `Total ${name}`;
      if (children.length > 0 && totalName) {
        children.push({
          id: `total-${level}-${name.replace(/\\s+/g, '-')}`,
          name: totalName,
          amount: amount,
          level: level,
          type: "total"
        });
      }

      return {
        id: `section-${level}-${name.replace(/\\s+/g, '-')}`,
        name,
        amount,
        level,
        type: "header",
        children
      };
    } else if (row.type === "Data") {
      const name = row.ColData?.[0]?.value || "";
      const id = row.ColData?.[0]?.id || `item-${name.replace(/\\s+/g, '-')}`;
      const amountStr = row.ColData?.[row.ColData.length - 1]?.value;
      const amount = amountStr ? parseFloat(amountStr) : 0;
      return {
        id,
        name,
        amount,
        level,
        type: "item"
      };
    }
    return null;
  };

  return root.Rows.Row.map((r: any) => parseRow(r, 0)).filter(Boolean) as FinancialLine[];
}

export function parseQBBalanceSheetDetails(qbData: any): DetailedFinancialData {
  const root = qbData.data ? qbData.data : qbData;
  if (!root || !root.Rows || !root.Rows.Row) return { groups: [], grandTotal: 0 };

  const groups: { id: string; name: string; accounts: AccountDetail[]; total: number }[] = [];

  // Recursively find Data rows to treat as accounts to simulate detail transactions
  const findAccounts = (rows: any[], currentAccountList: AccountDetail[]) => {
    for (const r of rows) {
      if (r.type === "Data") {
        const name = r.ColData?.[0]?.value || "Unknown Account";
        const id = r.ColData?.[0]?.id || `acc-${name.replace(/\\s+/g, '-')}`;
        const amountStr = r.ColData?.[r.ColData.length - 1]?.value;
        const amount = amountStr ? parseFloat(amountStr) : 0;

        // If the row lacks transaction details, provide a default summary transaction
        currentAccountList.push({
          id,
          name,
          total: amount,
          transactions: [
            {
              id: `t-${id}`,
              date: root.Header?.EndPeriod || new Date().toISOString().split('T')[0],
              type: "Balance",
              num: "",
              name: "",
              memo: "Ending Balance",
              split: "",
              amount: amount,
              balance: amount
            }
          ]
        });
      } else if (r.type === "Section" && r.Rows?.Row) {
        findAccounts(r.Rows.Row, currentAccountList);
      }
    }
  };

  let grandTotal = 0;

  for (const mainRow of root.Rows.Row) {
    if (mainRow.type === "Section") {
      const groupName = mainRow.Header?.ColData?.[0]?.value || "";
      const amountStr = mainRow.Summary?.ColData?.[mainRow.Summary.ColData.length - 1]?.value;
      const total = amountStr ? parseFloat(amountStr) : 0;

      const accounts: AccountDetail[] = [];
      if (mainRow.Rows?.Row) {
        findAccounts(mainRow.Rows.Row, accounts);
      }

      groups.push({
        id: groupName.replace(/\\s+/g, '-').toLowerCase(),
        name: groupName,
        total,
        accounts
      });

      if (groupName.toUpperCase().includes("ASSETS")) {
        grandTotal = total;
      } else if (groupName.toUpperCase().includes("LIABILITIES AND EQUITY") && grandTotal === 0) {
        grandTotal = total;
      }
    }
  }

  return { groups, grandTotal };
}

export function parseQBInvoices(qbData: any): Invoice[] {
  const invoices = qbData?.QueryResponse?.Invoice || qbData?.data?.QueryResponse?.Invoice || qbData?.Invoice || [];

  return invoices.map((inv: any) => {
    const balance = inv.Balance || 0;
    const amount = inv.TotalAmt || 0;
    const dueDate = inv.DueDate || inv.TxnDate || "";

    let status: "paid" | "open" | "overdue" | "draft" = "open";
    if (balance <= 0) {
      status = "paid";
    } else {
      const due = new Date(dueDate);
      const today = new Date();
      // Reset times to compare only dates
      due.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);

      if (due < today) {
        status = "overdue";
      }
    }

    return {
      id: inv.Id,
      invoiceNumber: inv.DocNumber || `INV-${inv.Id}`,
      customer: inv.CustomerRef?.name || "Unknown Customer",
      date: inv.TxnDate || "",
      dueDate: dueDate,
      amount: amount,
      balance: balance,
      status: status
    };
  });
}

export function parseQBCustomers(qbData: any): Customer[] {
  const customers = qbData?.QueryResponse?.Customer || qbData?.data?.QueryResponse?.Customer || qbData?.Customer || [];

  return customers.map((c: any) => {
    // Determine status. QuickBooks uses Active (boolean). 
    // We can guess "overdue" if balance is very high or just stick to active/inactive.
    let status: "active" | "inactive" | "overdue" = "active";
    if (c.Active === false) {
      status = "inactive";
    } else if (c.Balance > 0) {
      status = "active"; // Could be overdue, but can't be sure without invoice data
    }

    return {
      id: c.Id,
      name: c.DisplayName || c.FullyQualifiedName || c.CompanyName || `${c.GivenName || ''} ${c.FamilyName || ''}`.trim() || "Unknown",
      email: c.PrimaryEmailAddr?.Address || "",
      phone: c.PrimaryPhone?.FreeFormNumber || c.Mobile?.FreeFormNumber || "",
      balance: c.Balance || 0,
      status: status,
      lastInvoice: c.MetaData?.LastUpdatedTime ? c.MetaData.LastUpdatedTime.split('T')[0] : "",
      totalSpent: c.Balance || 0
    };
  });
}
