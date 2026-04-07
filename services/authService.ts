const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");

// ─── Types ──────────────────────────────────────────────

export interface SyncedEntity {
  name: string;
  count: number;
  lastSync: string;
  status: "synced" | "syncing" | "error";
}

export interface ConnectionStatusResponse {
  isConnected: boolean;
  companyName?: string;
  companyId?: string;
  environment?: "sandbox" | "production";
  connectedAt?: string;
  lastSynced?: string;
  tokenExpiresAt?: string;
  syncedEntities?: SyncedEntity[];
}

export interface DisconnectResponse {
  success: boolean;
  message: string;
}

// ─── API Functions ──────────────────────────────────────

/**
 * Check QuickBooks connection status.
 * Called on page mount and after connect/disconnect/sync.
 */
export async function getConnectionStatus(): Promise<ConnectionStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/status`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Status check failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Redirect the browser to the QuickBooks OAuth flow.
 * After authorization, the backend redirects back to /connections.
 */
export function connectQuickbooks(): void {
  window.location.href = `${API_BASE_URL}/api/auth/quickbooks`;
}

/**
 * Disconnect from QuickBooks — clears tokens on the backend.
 */
export async function disconnectQuickbooks(): Promise<DisconnectResponse> {
  const res = await fetch(`${API_BASE_URL}/api/auth/disconnect`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Disconnect failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/**
 * Refresh the QuickBooks access token.
 */
export async function refreshQuickbooksToken(): Promise<unknown> {
  const res = await fetch(`${API_BASE_URL}/refresh-token`, {
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Token refresh failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}
