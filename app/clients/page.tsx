"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { SkeletonTable } from "@/components/SkeletonLoader";
import { Plus, MoreHorizontal, Download, CheckCircle2, AlertCircle, FileText, UploadCloud, Eye, FileEdit, RefreshCw } from "lucide-react";
import Pagination from "@/components/Pagination";
import AdvancedFilterToolbar from "@/components/AdvancedFilterToolbar";
import AddCustomerModal from "@/components/AddCustomerModal";
import { formatCurrency, cn } from "@/lib/utils";
import { useCustomers } from "@/hooks/useCustomers";
import { filterCustomers } from "@/lib/filters";
import { exportToCSV } from "@/lib/exportCSV";
import GenericEditModal from "@/components/GenericEditModal";
import { updateCustomer, createCustomer } from "@/services/customerService";
import { refreshQuickbooksToken } from "@/services/authService";
import { Mail, Phone, MapPin, UserSquare2, ShieldCheck, FileCheck } from "lucide-react";

const ITEMS_PER_PAGE = 8;

export default function CustomersPage() {
  const { customers, setCustomers, isLoading, error } = useCustomers();

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<any>(null);
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

  const handleUpdateCustomer = async (formData: any) => {
    if (!editingCustomer) return;
    await updateCustomer(editingCustomer.id, formData);
    // Update local state for smooth UX
    setCustomers(customers.map((c: any) => c.id === editingCustomer.id ? { ...c, ...formData } : c));
  };

  const filteredCustomers = filterCustomers(customers, {
    searchTerm,
    statusFilter
  });

  const totalPages = Math.ceil(filteredCustomers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedCustomers = filteredCustomers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleAddCustomer = async (newCustomer: any) => {
    try {
      await createCustomer(newCustomer);
      // Wait 1.5s for QuickBooks indexing to complete
      setTimeout(() => {
        window.location.reload(); 
      }, 1500);
    } catch (err: any) {
      alert(err.message || "Failed to add client");
    }
  };

  const handleExportCSV = () => {
    exportToCSV(
      filteredCustomers,
      ["ID", "Name", "Email", "Phone", "Status", "Balance", "Last Updated", "Created Date"],
      "customers_export",
      (c: any) => [c.id, c.name, c.email, c.phone, c.status, c.balance, c.lastUpdated, c.createdDate]
    );
  };

  const statusConfig = (status: string) => {
    const configs: Record<string, { label: string; icon: any; color: string }> = {
      active: { label: "Active", icon: CheckCircle2, color: "bg-[#8bc53d] text-white border-transparent" },
      inactive: { label: "Inactive", icon: FileText, color: "bg-[#6D6E71] text-white border-transparent" },
      overdue: { label: "Overdue", icon: AlertCircle, color: "bg-[#C62026] text-white border-transparent" },
    };
    return configs[status.toLowerCase()] || configs.active;
  };

  return (
    <>
      <Header title="Clients" />
      <div className="flex-1 p-6 space-y-5">

        {/* Top Header / Action Row */}
        <div className="flex items-center justify-between">
          <h1 className="page-title mb-0">Clients</h1>
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
              Export CSV
            </button>
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary"
            >
              <Plus size={16} />
              Add Client
            </button>
          </div>
        </div>

        {/* Filter Toolbar Component */}
        <AdvancedFilterToolbar
          placeholder="Search client"
          onSearch={setSearchTerm}
          onFilterChange={(key, val) => {
            if (key === "status") setStatusFilter(val);
            setCurrentPage(1);
          }}
          onReset={() => {
            setSearchTerm("");
            setStatusFilter("all");
            setCurrentPage(1);
          }}
          statusOptions={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
            { label: "Overdue", value: "overdue" }
          ]}
        />

        {/* Table/List View */}
        {isLoading ? (
          <SkeletonTable />
        ) : error && customers.length === 0 ? (
          <div className="bg-red-50 text-red-600 p-6 rounded-md font-medium flex items-center gap-3 border border-red-200 mt-4">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {error}
          </div>
        ) : (
          <div className="card-base overflow-hidden">
            <div className="overflow-x-auto min-h-[500px]">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-[14px] font-medium text-text-muted py-3 px-6">Name & ID</th>
                    <th className="text-left text-[14px] font-medium text-text-muted py-3 px-4">Contact</th>
                    <th className="text-right text-[14px] font-medium text-text-muted py-3 px-4">Balance</th>
                    <th className="text-right text-[14px] font-medium text-text-muted py-3 px-4">Last Updated</th>
                    <th className="text-center text-[14px] font-medium text-text-muted py-3 px-4">Status</th>
                    <th className="text-right text-[14px] font-medium text-text-muted py-3 px-4 w-32">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {paginatedCustomers.length > 0 ? (
                    paginatedCustomers.map((customer) => (
                      <tr key={customer.id} className="group hover:bg-bg-page/50 transition-colors duration-200">
                        <td className="py-3 px-6">
                          <div>
                            <p className="text-[14px] font-medium text-text-primary group-hover:text-primary transition-colors">{customer.name}</p>
                            <span className="text-[12px] text-text-muted">{customer.id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-col">
                            <span className="text-[14px] text-text-secondary">{customer.email}</span>
                            <span className="text-[12px] text-text-muted">{customer.phone}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          <span className={cn(
                            "text-[14px] text-text-primary",
                            customer.balance < 0 ? "text-negative" : ""
                          )}>
                            {formatCurrency(customer.balance)}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums">
                          <span className="text-[14px] text-text-primary">
                            {customer.lastUpdated}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-center">
                          {(() => {
                            const config = statusConfig(customer.status);
                            return (
                              <span className={cn(
                                "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[12px] font-bold capitalize min-w-[80px]",
                                config.color
                              )}>
                                {customer.status}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button 
                            onClick={() => {
                              setEditingCustomer(customer);
                              setIsEditModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 border border-border rounded-lg text-[12px] font-semibold text-text-primary hover:bg-bg-page hover:border-primary/30 transition-all shadow-sm bg-white ml-auto"
                          >
                            <FileEdit size={14} className="text-text-muted" />
                            <span>Edit</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="p-4 bg-bg-page rounded-full text-text-muted">
                            <Plus size={28} />
                          </div>
                          <p className="text-[14px] font-semibold text-text-primary">No Matches Found</p>
                          <p className="text-[12px] text-text-muted">Refine your search parameters or add a new client</p>
                          <button
                            onClick={() => { setSearchTerm(""); setStatusFilter("all"); }}
                            className="mt-1 text-[14px] font-medium text-primary hover:text-primary-dark cursor-pointer"
                          >
                            Clear all filters
                          </button>
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
        onSave={handleUpdateCustomer}
        initialData={editingCustomer}
        title="Edit Client"
        mode="edit"
        variant="drawer"
        fields={[
          { name: "name", label: "Full Name", type: "text", icon: UserSquare2 },
          { name: "email", label: "Email Address", type: "email", icon: Mail },
          { name: "phone", label: "Phone Number", type: "tel", icon: Phone },
          { name: "balance", label: "Balance Due", type: "text", icon: ShieldCheck, disabled: true },
          {
            name: "status", label: "Current Status", type: "select", icon: FileCheck, options: [
              { label: "Active", value: "active" },
              { label: "Inactive", value: "inactive" },
              { label: "Overdue", value: "overdue" },
            ]
          }
        ]}
      />

      <AddCustomerModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAdd={handleAddCustomer}
      />
    </>
  );
}
