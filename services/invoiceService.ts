import { fetchWithAuth } from "./apiService";

export async function fetchInvoices() {
  try {
    return await fetchWithAuth("/invoices");
  } catch (error) {
    console.warn(`[Network Error] Failed to fetch invoices:`, error);
    return { QueryResponse: { Invoice: [] } };
  }
}

export async function updateInvoice(id: string, data: any) {
  return await fetchWithAuth(`/api/invoices/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function getInvoiceByDocNumber(docNumber: string) {
  try {
    return await fetchWithAuth(`/invoices/doc/${docNumber}`);
  } catch (error) {
    console.error(`[API Error] getInvoiceByDocNumber:`, error);
    return null;
  }
}
