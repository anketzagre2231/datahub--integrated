import { useState, useEffect } from "react";
import { fetchInvoices } from "@/services/invoiceService";
import { Invoice } from "@/types/invoices";

export function useInvoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadInvoices() {
      try {
        const response = await fetchInvoices();
        const apiInvs = Array.isArray(response?.QueryResponse?.Invoice)
          ? response.QueryResponse.Invoice
          : Array.isArray(response?.data?.QueryResponse?.Invoice)
            ? response.data.QueryResponse.Invoice
            : (Array.isArray(response) ? response : []);

        const mappedInvs = apiInvs.map((inv: any) => {
          const amount = inv.TotalAmt || inv.amount || 0;
          const balance = inv.Balance || inv.balance || 0;
          let status = "open";
          if (balance === 0) status = "paid";
          else if (new Date(inv.DueDate) < new Date()) status = "overdue";

          return {
            id: inv.DocNumber || inv.id || "Unknown",
            invoiceNumber: inv.DocNumber || inv.id || "Unknown",
            customer: inv.CustomerRef?.name || inv.customer || "Unknown",
            amount,
            balance,
            date: inv.TxnDate || inv.date || new Date().toISOString().split("T")[0],
            status,
            dueDate: inv.DueDate || inv.dueDate || "N/A",
            privateNote: inv.PrivateNote || ""
          };
        });

        if (isMounted) {
          setInvoices(mappedInvs);
          setIsLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error("Failed to load invoices API:", err);
        if (isMounted) {
          setError("Failed to load invoices. Please try again later.");
          setIsLoading(false);
        }
      }
    }
    loadInvoices();

    return () => { isMounted = false; };
  }, []);

  return { invoices, setInvoices, isLoading, error };
}
