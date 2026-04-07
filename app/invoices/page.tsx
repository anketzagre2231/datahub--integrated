"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { SkeletonTable } from "@/components/SkeletonLoader";
import { useCustomers } from "@/hooks/useCustomers";
import {
  Plus,
  MoreHorizontal,
  Download,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  Calendar,
  DollarSign,
  Activity,
  User,
  Eye,
  Mail,
  Globe,
  UploadCloud,
  RefreshCw
} from "lucide-react";
import Pagination from "@/components/Pagination";
import AdvancedFilterToolbar from "@/components/AdvancedFilterToolbar";
import { formatCurrency, cn } from "@/lib/utils";
import { useInvoices } from "@/hooks/useInvoices";
import { filterInvoices } from "@/lib/filters";
import { exportToCSV } from "@/lib/exportCSV";
import GenericEditModal from "@/components/GenericEditModal";
import { updateInvoice, getInvoiceByDocNumber } from "@/services/invoiceService";
import { getConnectionStatus, refreshQuickbooksToken } from "@/services/authService";

const ITEMS_PER_PAGE = 10;

export default function InvoicesPage() {
  const { invoices, setInvoices, isLoading, error } = useInvoices();
  const { customers } = useCustomers();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<any>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshQuickbooksToken();
      window.location.reload();
    } catch (err) {
      console.error("Sync failed:", err);
      alert("Sync failed. Please try again.");
    } finally {
      setIsSyncing(false);
    }
  };

  const isComplexUpdate = (original: any, data: any) => {
    // Check if any restricted fields are modified
    return (
      data.amount !== original.amount ||
      data.balance !== original.balance ||
      data.customerId !== original.customerId ||
      data.status !== original.status
    );
  };

  const openQuickBooksInvoice = (invoiceId: string) => {
    const baseUrl =
      process.env.NEXT_PUBLIC_QB_ENV === "production"
        ? "https://qbo.intuit.com/app/invoice"
        : "https://sandbox.qbo.intuit.com/app/invoice";
    const url = `${baseUrl}?txnId=${invoiceId}`;
    window.open(url, "_blank");
  };

  const handleUpdateInvoice = async (formData: any) => {
    if (!editingInvoice) return;

    try {
      const status = await getConnectionStatus();
      if (!status.isConnected) {
        alert("Please connect to QuickBooks");
        throw new Error("Please connect to QuickBooks");
      }
    } catch (e) {
      alert("Please connect to QuickBooks");
      throw new Error("Please connect to QuickBooks");
    }

    if (isComplexUpdate(editingInvoice, formData)) {
      alert("Redirecting to QuickBooks for advanced editing");
      openQuickBooksInvoice(editingInvoice.id || editingInvoice.invoiceNumber);
      setIsEditModalOpen(false);
      return; // Do NOT call API
    }

    // simple update
    await updateInvoice(editingInvoice.id, formData);
    // Update local state for smooth UX
    setInvoices((prev: any) => prev.map((inv: any) => inv.id === editingInvoice.id ? { ...inv, ...formData } : inv));
  };

  const filteredInvoices = filterInvoices(invoices, {
    searchTerm,
    statusFilter,
    dateFilter,
    customerFilter,
    startDate,
    endDate
  });

  const totalPages = Math.ceil(filteredInvoices.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const statusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: any; color: string }> = {
      paid: { label: "Paid", icon: CheckCircle2, color: "bg-[#8bc53d] text-white border-transparent" },
      open: { label: "Open", icon: Clock, color: "bg-[#00648F] text-white border-transparent" },
      overdue: { label: "Overdue", icon: AlertCircle, color: "bg-[#C62026] text-white border-transparent" },
      draft: { label: "Draft", icon: FileText, color: "bg-[#6D6E71] text-white border-transparent" },
    };
    return configs[status.toLowerCase()] || configs.draft;
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredInvoices,
      ["Invoice Number", "Client", "Date", "Due Date", "Status", "Total Amount", "Balance Due"],
      "invoices_export",
      (inv: any) => [inv.invoiceNumber, inv.customer, inv.date, inv.dueDate, inv.status, inv.amount, inv.balance]
    );
  };

  return (
    <>
      <Header title="Invoices" />
      <div className="flex-1 p-6 space-y-5">

        {/* Page Header */}
        <div className="flex items-center justify-between">
          <h1 className="page-title mb-0">Invoices</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-secondary"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync"}
            </button>
            <button
              onClick={handleExportCSV}
              className="btn-secondary"
            >
              <Download size={16} className="text-text-muted" />
              Export Ledger
            </button>
          </div>
        </div>

        {/* Filters */}
        <AdvancedFilterToolbar
          placeholder="Search by invoice # or client..."
          onSearch={setSearchTerm}
          onFilterChange={(key, val) => {
            if (key === "status") setStatusFilter(val);
            if (key === "date") setDateFilter(val);
            if (key === "customer") setCustomerFilter(val);
            setCurrentPage(1);
          }}
          onReset={() => {
            setSearchTerm("");
            setStatusFilter("all");
            setDateFilter("all");
            setStartDate("");
            setEndDate("");
            setCustomerFilter("all");
            setCurrentPage(1);
          }}
          statusOptions={[
            { label: "Paid", value: "paid" },
            { label: "Open", value: "open" },
            { label: "Overdue", value: "overdue" },
            { label: "Draft", value: "draft" }
          ]}
          dateOptions={[
            { label: "This Month", value: "this-month" },
            { label: "Last Month", value: "last-month" },
            { label: "Custom Range", value: "custom" }
          ]}
          showCustomerFilter={true}
          customerOptions={customers.map((c: any) => ({ label: c.name, value: c.name }))}
        />

        {/* Custom Date Range Inputs */}
        {dateFilter === "custom" && (
          <div className="flex items-center gap-4 card-base p-4 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-text-muted">From:</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 px-3 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[14px] text-text-muted">To:</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 px-3 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
              />
            </div>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <SkeletonTable />
        ) : error && invoices.length === 0 ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-md font-medium flex items-center gap-3 border border-red-200">
            <AlertCircle size={20} />
            {error}
          </div>
        ) : (
          <div className="card-base overflow-hidden">
            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[14px] font-medium text-text-muted py-3 px-6">Invoice & Date</th>
                    <th className="text-left text-[14px] font-medium text-text-muted py-3 px-4">Client</th>
                    <th className="text-left text-[14px] font-medium text-text-muted py-3 px-4">Due Date</th>
                    <th className="text-right text-[14px] font-medium text-text-muted py-3 px-4">Amount</th>
                    <th className="text-right text-[14px] font-medium text-text-muted py-3 px-4">Balance</th>
                    <th className="text-center text-[14px] font-medium text-text-muted py-3 px-4">Status</th>
                    <th className="text-right text-[14px] font-medium text-text-muted py-3 px-4 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedInvoices.length > 0 ? (
                    paginatedInvoices.map((invoice) => {
                      const status = statusConfig(invoice.status);
                      const StatusIcon = status.icon;
                      return (
                        <tr key={invoice.id} className="group hover:bg-bg-page/50 transition-colors duration-200">
                          <td className="py-3 px-6">
                            <div className="flex flex-col">
                              <span className="text-[14px] font-medium text-text-primary">#{invoice.invoiceNumber}</span>
                              <span className="text-[12px] text-text-muted">
                                {new Date(invoice.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-[14px] text-text-secondary">{invoice.customer}</span>
                          </td>
                          <td className="py-3 px-4">
                            <span className={cn(
                              "text-[14px] text-text-secondary",
                              invoice.status === "overdue" && "text-negative font-medium"
                            )}>
                              {new Date(invoice.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className="text-[14px] font-medium text-text-primary">
                              {formatCurrency(invoice.amount)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right tabular-nums">
                            <span className={cn(
                              "text-[14px] font-medium",
                              invoice.balance > 0 ? "text-text-primary" : "text-text-muted"
                            )}>
                              {formatCurrency(invoice.balance)}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className={cn(
                              "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[12px] font-bold capitalize min-w-[80px]",
                              status.color
                            )}>
                              {status.label}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={async () => {
                                setIsDetailLoading(true);
                                const res = await getInvoiceByDocNumber(invoice.invoiceNumber);
                                const detail = res?.data || res;
                                const matchingCustomer = customers.find((c: any) => c.name === invoice.customer);

                                setEditingInvoice({
                                  ...invoice,
                                  ...detail,
                                  docNumber: detail?.DocNumber || invoice.invoiceNumber,
                                  privateNote: detail?.PrivateNote || invoice.privateNote || "",
                                  customerId: (invoice as any).customerId || detail?.CustomerRef?.value || (matchingCustomer as any)?.id || (matchingCustomer as any)?.Id || "",
                                  email: detail?.BillEmail?.Address || "N/A",
                                  terms: detail?.SalesTermRef?.name || "N/A",
                                  currency: detail?.CurrencyRef?.name || "USD",
                                  txnDate: detail?.TxnDate || invoice.date,
                                  totalAmt: detail?.TotalAmt || invoice.amount,
                                });
                                setIsDetailLoading(false);
                                setIsEditModalOpen(true);
                              }}
                              disabled={isDetailLoading}
                              className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-border rounded-lg text-[12px] font-semibold text-text-primary hover:bg-bg-page hover:border-primary/30 transition-all shadow-sm bg-white ml-auto disabled:opacity-50"
                            >
                              <Eye size={14} className="text-text-muted" />
                              <span>Doc</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-[14px] font-semibold text-text-primary">No Invoices Found</p>
                          <p className="text-[12px] text-text-muted">Adjust your filters to refine the search</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-bg-page/30 border-t border-border">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                className="bg-transparent border-0"
              />
            </div>
          </div>
        )}
      </div>
      <GenericEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSave={handleUpdateInvoice}
        initialData={editingInvoice}
        title="View Invoice"
        mode="view"
        variant="drawer"
        fields={[
          { name: "docNumber", label: "Invoice Number", type: "text", icon: FileText },
          { name: "txnDate", label: "Invoice Date", type: "text", icon: Calendar },
          { name: "dueDate", label: "Due Date", type: "text", placeholder: "YYYY-MM-DD", icon: Calendar },
          { name: "email", label: "Billing Email", type: "text", icon: Mail },
          { name: "terms", label: "Sales Terms", type: "text", icon: Clock },
          { name: "currency", label: "Currency", type: "text", icon: Globe },
          { name: "privateNote", label: "Note (Private)", type: "textarea", icon: FileText },
          {
            name: "customerId",
            label: "Client",
            type: "select",
            icon: User,
            options: customers.map((c: any) => ({ label: c.name, value: c.id || c.Id }))
          },
          { name: "totalAmt", label: "Total Amount", type: "text", icon: DollarSign },
          { name: "balance", label: "Balance Due", type: "text", icon: Activity },
          {
            name: "status", label: "Status", type: "select", options: [
              { label: "Paid", value: "paid" },
              { label: "Open", value: "open" },
              { label: "Overdue", value: "overdue" },
              { label: "Draft", value: "draft" }
            ]
          }
        ]}
      />
    </>
  );
}
