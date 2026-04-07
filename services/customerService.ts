import { fetchWithAuth } from "./apiService";

export async function fetchCustomers() {
  try {
    return await fetchWithAuth("/customers");
  } catch (error) {
    console.warn(`[Network Error] Failed to fetch customers:`, error);
    return { QueryResponse: { Customer: [] } };
  }
}

export async function updateCustomer(id: string, data: any) {
  return await fetchWithAuth(`/api/customers/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}

export async function createCustomer(data: any) {
  return await fetchWithAuth("/customers", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  });
}
