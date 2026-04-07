import { 
  parseQBBalanceSheet, 
  parseQBBalanceSheetDetails, 
  parseQBInvoices, 
  parseQBCustomers 
} from "@/lib/quickbooks-parser";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");

async function apiFetch(endpoint: string, options: RequestInit = {}, retries = 1) {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
    
    // Automatic Token Refresh Logic on Unauthorized
    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && retries > 0) {
        console.warn(`[Auth Error] ${endpoint} returned ${response.status}. Attempting to refresh token...`);
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/refresh-token`);
          if (refreshRes.ok) {
             console.log("Token refreshed successfully. Retrying original request...");
             return await apiFetch(endpoint, options, retries - 1);
          }
        } catch (refreshErr) {
          console.error("Failed to automatically refresh token:", refreshErr);
        }
      }
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`[API Fetch Error] ${endpoint}:`, error);
    throw error;
  }
}

export const QuickbooksService = {
  async getBalanceSheet() {
    const rawData = await apiFetch("/balance-sheet");
    return parseQBBalanceSheet(rawData);
  },

  async getBalanceSheetDetails() {
    const rawData = await apiFetch("/balance-sheet-detail");
    return parseQBBalanceSheetDetails(rawData);
  },

  async getInvoices() {
    const rawData = await apiFetch("/invoices");
    return parseQBInvoices(rawData);
  },

  async getCustomers() {
    const rawData = await apiFetch("/customers");
    return parseQBCustomers(rawData);
  },

  async refreshToken() {
    // Manually hit the refresh token endpoint
    return await apiFetch("/refresh-token");
  }
};
