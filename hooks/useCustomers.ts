import { useState, useEffect } from "react";
import { fetchCustomers } from "@/services/customerService";
import { fetchInvoices } from "@/services/invoiceService";
import { Customer } from "@/types/customers";

export function useCustomers() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadCustomers() {
      try {
        const [custResponse, invResponse] = await Promise.all([
          fetchCustomers(),
          fetchInvoices().catch(() => ({ QueryResponse: { Invoice: [] } }))
        ]);

        const apiInvs = Array.isArray(invResponse?.QueryResponse?.Invoice)
          ? invResponse.QueryResponse.Invoice
          : Array.isArray(invResponse?.data?.QueryResponse?.Invoice)
            ? invResponse.data.QueryResponse.Invoice
            : (Array.isArray(invResponse) ? invResponse : []);

        const apiCustomers = Array.isArray(custResponse?.QueryResponse?.Customer)
          ? custResponse.QueryResponse.Customer
          : Array.isArray(custResponse?.data?.QueryResponse?.Customer)
            ? custResponse.data.QueryResponse.Customer
            : (Array.isArray(custResponse) ? custResponse : []);

        const mappedCustomers = apiCustomers.map((c: any) => {
          const customerName = c.DisplayName || c.FullyQualifiedName || "Unknown";

          // Check for overdue invoices for this specific customer
          const hasOverdueInvoice = apiInvs.some((inv: any) => {
            const invCustomer = inv.CustomerRef?.name || inv.customer;
            const balance = parseFloat(inv.Balance) || parseFloat(inv.balance) || 0;
            const dueDate = new Date(inv.DueDate || inv.dueDate);
            return (
              invCustomer === customerName &&
              balance > 0 &&
              dueDate < new Date()
            );
          });

          return {
            id: c.Id || c.id,
            name: customerName,
            email: c.PrimaryEmailAddr?.Address || c.email || "N/A",
            phone: c.PrimaryPhone?.FreeFormNumber || c.phone || "N/A",
            balance: parseFloat(c.Balance) || parseFloat(c.balance) || 0,
            status: hasOverdueInvoice ? "overdue" : (c.Active === false ? "inactive" : "active"),
            lastUpdated: c.MetaData?.LastUpdatedTime ? new Date(c.MetaData.LastUpdatedTime).toLocaleDateString() : "N/A",
            createdDate: c.MetaData?.CreateTime ? new Date(c.MetaData.CreateTime).toLocaleDateString() : "N/A",
          };
        });

        if (isMounted) {
          setCustomers(mappedCustomers);
          setIsLoading(false);
          setError(null);
        }
      } catch (err: any) {
        console.error("Failed to load customers API:", err);
        if (isMounted) {
          setError("Failed to load clients. Please try again later.");
          setIsLoading(false);
        }
      }
    }
    loadCustomers();

    return () => { isMounted = false; };
  }, []);

  return { customers, setCustomers, isLoading, error };
}
