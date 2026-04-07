"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/Header";
import {
  Link2Off,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Clock,
  Shield,
  Database,
  ChevronRight,
  Zap,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  getConnectionStatus,
  connectQuickbooks,
  disconnectQuickbooks,
  refreshQuickbooksToken,
  type ConnectionStatusResponse,
} from "@/services/authService";
import { fetchCustomers } from "@/services/customerService";
import { fetchInvoices } from "@/services/invoiceService";

// ─── Helpers ────────────────────────────────────────────

function formatDate(dateStr: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function timeAgo(dateStr: string) {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function getTimeLeft(dateStr: string) {
  if (!dateStr) return "—";
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Expired";
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes} Min Left`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} Hours Left`;
  const days = Math.floor(hours / 24);
  return `${days} Days Left`;
}

// ─── Page States ────────────────────────────────────────

type PageState = "loading" | "connected" | "disconnected" | "error";

// ─── Component ──────────────────────────────────────────

export default function ConnectionsPage() {
  const [pageState, setPageState] = useState<PageState>("loading");
  const [connection, setConnection] = useState<ConnectionStatusResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dynamicEntities, setDynamicEntities] = useState<any[] | null>(null);

  const [isSyncing, setIsSyncing] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);

  // ── Fetch status from backend (single source of truth) ──
  const fetchStatus = useCallback(async (showLoader = true) => {
    if (showLoader) setPageState("loading");
    setErrorMessage(null);
    try {
      const data = await getConnectionStatus();
      setConnection(data);
      setPageState(data.isConnected ? "connected" : "disconnected");

      if (data.isConnected) {
        Promise.all([
          fetchCustomers().catch(() => ({})),
          fetchInvoices().catch(() => ({})),
        ]).then(([customersRes, invoicesRes]) => {
          const custs = Array.isArray(customersRes?.QueryResponse?.Customer) ? customersRes.QueryResponse.Customer :
            Array.isArray(customersRes?.data?.QueryResponse?.Customer) ? customersRes.data.QueryResponse.Customer :
              (Array.isArray(customersRes) ? customersRes : []);

          const invs = Array.isArray(invoicesRes?.QueryResponse?.Invoice) ? invoicesRes.QueryResponse.Invoice :
            Array.isArray(invoicesRes?.data?.QueryResponse?.Invoice) ? invoicesRes.data.QueryResponse.Invoice :
              (Array.isArray(invoicesRes) ? invoicesRes : []);

          const cCount = custs.length;
          const iCount = invs.length;
          
          setDynamicEntities([
            {
              name: "Customers",
              count: cCount,
              lastSync: data.lastSynced,
              status: "synced"
            },
            {
              name: "Invoices",
              count: iCount,
              lastSync: data.lastSynced,
              status: "synced"
            }
          ]);
        });
      }
    } catch (err) {
      console.error("Failed to fetch connection status:", err);
      setConnection(null);
      setPageState("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Could not reach the backend. Is it running?"
      );
    }
  }, []);

  // ── On mount: always check real status ──
  useEffect(() => {
    fetchStatus(true);
  }, [fetchStatus]);

  // ── Connect: redirect to OAuth ──
  const handleConnect = () => {
    connectQuickbooks();
  };

  // ── Disconnect: call API, then re-fetch status ──
  const handleDisconnect = async () => {
    setIsDisconnecting(true);
    try {
      await disconnectQuickbooks();
      setShowDisconnectModal(false);
      await fetchStatus(true); // re-sync UI with backend
    } catch (err) {
      console.error("Disconnect failed:", err);
      setErrorMessage("Failed to disconnect. Please try again.");
    } finally {
      setIsDisconnecting(false);
    }
  };

  // ── Sync: refresh token, then re-fetch status ──
  const handleSync = async () => {
    setIsSyncing(true);
    setErrorMessage(null);
    try {
      await refreshQuickbooksToken();
      console.log("Token refreshed successfully");
      await fetchStatus(false); // background sync UI with backend
    } catch (err) {
      console.error("Sync/Refresh failed:", err);
      setErrorMessage("Token refresh failed. Your session may have expired — try reconnecting.");
    } finally {
      setIsSyncing(false);
    }
  };

  // ── Derived values ──
  const tokenTimeLeft = connection?.tokenExpiresAt
    ? getTimeLeft(connection.tokenExpiresAt)
    : "—";

  const isTokenExpired = tokenTimeLeft === "Expired";

  const activeEntities = dynamicEntities || connection?.syncedEntities || [];

  const totalSyncedRecords = activeEntities.reduce((sum, e) => sum + Number(e.count || 0), 0);

  // ────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────
  return (
    <>
      <Header title="Manage Connection" />
      <div className="flex-1 p-6 space-y-5">
        <h1 className="text-[24px] font-bold text-text-primary">Manage Connection</h1>

        {/* Error Banner */}
        {errorMessage && pageState !== "loading" && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-negative/30 bg-negative-bg text-negative text-[13px]">
            <AlertCircle size={16} className="shrink-0" />
            <span>{errorMessage}</span>
            {(errorMessage.toLowerCase().includes("expired") || errorMessage.toLowerCase().includes("disconnect")) && (
              <button
                onClick={handleConnect}
                className="ml-auto flex items-center gap-1 font-bold underline hover:text-negative-dark transition-colors"
              >
                <Zap size={14} fill="currentColor" /> Reconnect
              </button>
            )}
            <button
              onClick={() => setErrorMessage(null)}
              className={cn(
                "text-negative/60 hover:text-negative transition-colors font-bold",
                (errorMessage.toLowerCase().includes("expired") || errorMessage.toLowerCase().includes("disconnect")) ? "ml-4" : "ml-auto"
              )}
            >
              ✕
            </button>
          </div>
        )}

        {/* Token Expired Banner */}
        {pageState === "connected" && isTokenExpired && (
          <div className="flex items-center gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning-bg text-[13px]">
            <AlertCircle size={16} className="shrink-0 text-warning-dark" />
            <span className="text-warning-dark font-medium">
              Your QuickBooks session has expired. Automatic sync is paused until you reconnect.
            </span>
            <button
              onClick={handleConnect}
              className="ml-auto flex items-center gap-1 font-bold underline text-warning-dark hover:text-warning transition-colors"
            >
              <Zap size={14} fill="currentColor" /> Reconnect to QuickBooks
            </button>
          </div>
        )}

        {/* ─── Main Status Card ──────────────────────────── */}
        <div className="card-base overflow-hidden">
          {/* Status Bar */}
          <div
            className={cn(
              "px-6 py-3 flex items-center justify-between border-b-2",
              pageState === "connected"
                ? "bg-primary-light/10 border-primary"
                : "bg-bg-page border-border"
            )}
          >
            <div className="flex items-center gap-2">
              {pageState === "loading" && (
                <Loader2 size={16} className="text-text-muted animate-spin" />
              )}
              {pageState === "connected" && (
                <CheckCircle2 size={16} className="text-primary" />
              )}
              {pageState === "disconnected" && (
                <Link2Off size={16} className="text-text-secondary" />
              )}
              {pageState === "error" && (
                <AlertCircle size={16} className="text-negative" />
              )}
              <span
                className={cn(
                  "text-[14px] font-semibold",
                  pageState === "connected" && "text-primary",
                  pageState === "disconnected" && "text-text-secondary",
                  pageState === "loading" && "text-text-muted",
                  pageState === "error" && "text-negative"
                )}
              >
                {pageState === "loading" && "Checking connection..."}
                {pageState === "connected" && "Connected"}
                {pageState === "disconnected" && "Disconnected"}
                {pageState === "error" && "Connection Error"}
              </span>
            </div>
            {pageState === "connected" && connection?.lastSynced && (
              <span className="text-[12px] text-text-muted">
                Last synced: {timeAgo(connection.lastSynced)}
              </span>
            )}
          </div>

          {/* Card Body */}
          <div className="p-6">
            {/* Loading */}
            {pageState === "loading" && (
              <div className="space-y-4">
                <div className="skeleton h-12 w-64 rounded-md" />
                <div className="skeleton h-4 w-48 rounded-md" />
                <div className="skeleton h-4 w-36 rounded-md" />
              </div>
            )}

            {/* Connected */}
            {pageState === "connected" && connection && (
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-5">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-primary text-white font-bold text-xl">
                    QB
                  </div>
                  <div>
                    <h3 className="text-[18px] font-semibold text-text-primary">
                      QuickBooks Online
                    </h3>
                    <p className="text-[14px] text-text-secondary mb-3">
                      {connection.companyName || "Connected Company"}
                    </p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {connection.companyId && (
                        <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                          <Database size={13} /> Company ID:{" "}
                          <span className="font-medium text-text-secondary">
                            {connection.companyId}
                          </span>
                        </div>
                      )}
                      {connection.environment && (
                        <div className="flex items-center gap-1.5 text-[12px] text-text-muted">
                          <Shield size={13} /> Environment:{" "}
                          <span className="font-semibold text-primary capitalize">
                            {connection.environment}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="btn-primary"
                  >
                    <RefreshCw
                      size={16}
                      className={isSyncing ? "animate-spin" : ""}
                    />{" "}
                    {isSyncing ? "Syncing..." : "Sync Now"}
                  </button>
                  <button
                    onClick={() => setShowDisconnectModal(true)}
                    className="btn-negative"
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            )}

            {/* Disconnected */}
            {pageState === "disconnected" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-xl bg-bg-page mx-auto mb-4 flex items-center justify-center text-text-muted">
                  <Link2Off size={32} />
                </div>
                <h3 className="text-[18px] font-semibold text-text-primary mb-2">
                  No active connection
                </h3>
                <p className="text-[14px] text-text-secondary mb-6 max-w-sm mx-auto">
                  Connect your QuickBooks account to start syncing your financial
                  data automatically.
                </p>
                <button
                  onClick={handleConnect}
                  className="btn-primary h-11 px-8 shadow-md mx-auto"
                >
                  <Zap size={16} fill="white" /> Connect to QuickBooks
                </button>
              </div>
            )}

            {/* Error */}
            {pageState === "error" && (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-xl bg-negative-bg mx-auto mb-4 flex items-center justify-center text-negative">
                  <AlertCircle size={32} />
                </div>
                <h3 className="text-[18px] font-semibold text-text-primary mb-2">
                  Unable to check connection
                </h3>
                <p className="text-[14px] text-text-secondary mb-6 max-w-sm mx-auto">
                  {errorMessage ||
                    "Could not reach the backend server. Make sure it is running."}
                </p>
                <div className="flex items-center justify-center gap-3">
                  <button onClick={() => fetchStatus(true)} className="btn-primary h-10 px-6">
                    <RefreshCw size={16} /> Retry
                  </button>
                  <button
                    onClick={handleConnect}
                    className="btn-primary h-10 px-6"
                    style={{ background: "var(--accent-1)" }}
                  >
                    <Zap size={16} fill="white" /> Reconnect
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Info Grid (only when connected) ───────────── */}
        {pageState === "connected" && connection && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {/* Access Token Card */}
              <div className="card-base p-5">
                <div className="flex items-center gap-2 mb-3 text-text-muted text-[12px] font-medium">
                  <Shield size={14} className="text-accent-1" /> Access Token
                </div>
                <p className="text-[24px] font-bold text-text-primary">Active</p>
                <p className="text-[12px] text-text-muted mt-1">
                  Refreshed automatically
                </p>
              </div>

              {/* Token Expiry Card */}
              <div className="card-base p-5 border-l-4 border-l-warning">
                <div className="flex items-center gap-2 mb-3 text-text-muted text-[12px] font-medium">
                  <Clock size={14} className="text-warning" /> Token Expiry
                </div>
                {connection.tokenExpiresAt ? (
                  <>
                    <p className="text-[24px] font-bold text-warning">
                      {tokenTimeLeft}
                    </p>
                    <p className="text-[12px] text-text-muted mt-1">
                      Valid until {formatDate(connection.tokenExpiresAt)}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[24px] font-bold text-warning">~60 min</p>
                    <p className="text-[12px] text-text-muted mt-1">
                      Access tokens expire after ~1 hour
                    </p>
                  </>
                )}
              </div>

              {/* Records Synced Card */}
              <div className="card-base p-5">
                <div className="flex items-center gap-2 mb-3 text-text-muted text-[12px] font-medium">
                  <Database size={14} className="text-accent-3" /> Records Synced
                </div>
                <p className="text-[24px] font-bold text-text-primary">
                  {totalSyncedRecords > 0
                    ? totalSyncedRecords.toLocaleString()
                    : "—"}
                </p>
                <p className="text-[12px] text-text-muted mt-1">
                  {totalSyncedRecords > 0
                    ? "Total synchronized entries"
                    : "Sync data not available yet"}
                </p>
              </div>
            </div>

            {/* ─── Synced Entities Table ──────────────────── */}
            {activeEntities && activeEntities.length > 0 && (
              <div className="card-base overflow-hidden">
                <div className="px-6 py-4 border-b border-border">
                  <h3 className="text-[16px] font-semibold text-text-primary">
                    Synced Entities
                  </h3>
                </div>
                <div className="divide-y divide-border">
                  {activeEntities.map((entity, i) => (
                    <div
                      key={i}
                      className="px-6 py-3 flex items-center justify-between hover:bg-bg-page/50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-9 h-9 rounded-md bg-bg-page flex items-center justify-center text-text-secondary">
                          <Database size={18} />
                        </div>
                        <div>
                          <p className="text-[14px] font-medium text-text-primary">
                            {entity.name}
                          </p>
                          <p className="text-[12px] text-text-muted">
                            {entity.lastSync
                              ? `Last sync ${timeAgo(entity.lastSync)}`
                              : "Not synced yet"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-[14px] font-semibold text-text-primary">
                            {entity.count}
                          </p>
                          <p className="text-[11px] text-text-muted uppercase">
                            Entities
                          </p>
                        </div>
                        <span
                          className={cn(
                            "text-[11px] font-semibold px-2.5 py-1 rounded-full",
                            entity.status === "synced" &&
                              "bg-primary-light/40 text-primary-dark",
                            entity.status === "syncing" &&
                              "bg-warning-bg/40 text-warning",
                            entity.status === "error" &&
                              "bg-negative-bg text-negative"
                          )}
                        >
                          {entity.status === "synced" && "Synced"}
                          {entity.status === "syncing" && "Syncing..."}
                          {entity.status === "error" && "Error"}
                        </span>
                        <ChevronRight size={16} className="text-text-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ─── Connection Details ────────────────────── */}
            <div className="card-base p-6">
              <h3 className="text-[16px] font-semibold text-text-primary mb-5">
                Connection Details
              </h3>
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {connection.connectedAt && (
                  <div>
                    <p className="text-[12px] text-text-muted font-medium uppercase tracking-wider mb-1">
                      Connected Since
                    </p>
                    <p className="text-[14px] text-text-primary font-medium">
                      {formatDate(connection.connectedAt)}
                    </p>
                  </div>
                )}
                {connection.lastSynced && (
                  <div>
                    <p className="text-[12px] text-text-muted font-medium uppercase tracking-wider mb-1">
                      Last Data Sync
                    </p>
                    <p className="text-[14px] text-text-primary font-medium">
                      {formatDate(connection.lastSynced)}
                    </p>
                  </div>
                )}
                {connection.companyId && (
                  <div>
                    <p className="text-[12px] text-text-muted font-medium uppercase tracking-wider mb-1">
                      Realm ID
                    </p>
                    <p className="text-[14px] text-text-primary font-medium font-mono">
                      {connection.companyId}
                    </p>
                  </div>
                )}
                {connection.environment && (
                  <div>
                    <p className="text-[12px] text-text-muted font-medium uppercase tracking-wider mb-1">
                      Environment
                    </p>
                    <p className="text-[14px] text-primary font-semibold capitalize">
                      {connection.environment}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* ─── Disconnect Confirmation Modal ──────────────── */}
        {showDisconnectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => !isDisconnecting && setShowDisconnectModal(false)}
            />
            <div className="relative bg-bg-card rounded-xl border border-border w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
              <div className="w-12 h-12 bg-negative-bg rounded-full flex items-center justify-center mx-auto mb-4 text-negative">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-[18px] font-semibold text-center text-text-primary mb-2">
                Disconnect QuickBooks?
              </h3>
              <p className="text-[14px] text-text-secondary text-center leading-relaxed">
                This will stop all automatic syncing and revoke active tokens.
                Your existing data will remain as-is.
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowDisconnectModal(false)}
                  disabled={isDisconnecting}
                  className="flex-1 h-10 rounded-md border border-border font-medium text-[14px] hover:bg-bg-page transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDisconnect}
                  disabled={isDisconnecting}
                  className="flex-1 h-10 rounded-md bg-negative text-white font-semibold text-[14px] hover:bg-negative-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isDisconnecting ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />{" "}
                      Disconnecting...
                    </>
                  ) : (
                    "Disconnect"
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
