const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");

/**
 * Enhanced fetch with authentication, retry logic for 429, and automatic token refresh.
 */
export async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {},
  retries = 3,
): Promise<any> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const defaultOptions: RequestInit = {
    cache: "no-store",
    credentials: "include", // Ensure cookies are sent (needed for refresh-token/auth)
    ...options,
  };

  try {
    const res = await fetch(url, defaultOptions);

    if (!res.ok) {
      // 1. Handle Rate Limiting (429)
      if (res.status === 429 && retries > 0) {
        // Exponential backoff (2s, 4s, 8s...)
        const backoff = (4 - retries) * 2000;
        console.warn(`[Rate Limit] 429 on ${endpoint}. Retrying in ${backoff}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        return await fetchWithAuth(endpoint, options, retries - 1);
      }

      // 2. Handle Authentication Errors (401/403)
      if ((res.status === 401 || res.status === 403) && retries > 0) {
        console.warn(`[Auth Error] ${res.status} on ${endpoint}. Attempting token refresh...`);
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/refresh-token`, { 
            credentials: "include",
            cache: "no-store" 
          });
          if (refreshRes.ok) {
            return await fetchWithAuth(endpoint, options, retries - 1);
          }
        } catch (refreshErr) {
          console.error("[Refresh Error] Token refresh request failed:", refreshErr);
        }
      }

      // 3. Throw Error for other non-ok responses
      throw new Error(`API Request failed with status ${res.status} on ${endpoint}`);
    }

    // Try parsing as JSON, fallback to text if needed
    const contentType = res.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await res.json();
    }
    return await res.text();
    
  } catch (err) {
    console.error(`[fetchWithAuth Error] ${endpoint}:`, err);
    throw err;
  }
}
