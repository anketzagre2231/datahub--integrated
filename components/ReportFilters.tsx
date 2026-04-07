"use client";

import { useState } from "react";
import { RotateCcw, Filter, Download, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface ReportFiltersProps {
  onExport?: () => void;
}

export default function ReportFilters({ onExport }: ReportFiltersProps) {
  const [period, setPeriod] = useState("this-quarter");
  const [fromDate, setFromDate] = useState("2026-01-01");
  const [toDate, setToDate] = useState("2026-03-25");
  const [method, setMethod] = useState("accrual");

  const handleReset = () => {
    setPeriod("this-quarter");
    setFromDate("2026-01-01");
    setToDate("2026-03-25");
    setMethod("accrual");
  };

  return (
    <div
      className="bg-bg-card rounded-xl border border-border p-5"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-primary" />
          <h3 className="text-[14px] font-semibold text-text-primary">
            Report Parameters
          </h3>
        </div>
        <button
          onClick={onExport}
          className="flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-text-secondary border border-border rounded-md hover:bg-bg-page transition-all active:scale-[0.98]"
        >
          <Download size={14} className="text-text-muted" />
          Export
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-5">
        {/* Report Period */}
        <div className="flex flex-col gap-1.5 min-w-[180px]">
          <label className="text-[14px] font-medium text-text-primary px-0.5">
            Reporting Period
          </label>
          <div className="relative group">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-hover:text-primary transition-colors" />
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              className="w-full h-10 pl-9 pr-8 text-[14px] bg-bg-card border border-border-input rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all appearance-none cursor-pointer"
            >
              <option value="this-month">This Month</option>
              <option value="last-month">Last Month</option>
              <option value="this-quarter">This Quarter</option>
              <option value="last-quarter">Last Quarter</option>
              <option value="this-year">This Year</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>
        </div>

        {/* From Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-medium text-text-primary px-0.5">
            From
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="h-10 px-3 text-[13px] bg-bg-card border border-border-input rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
        </div>

        {/* To Date */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-medium text-text-primary px-0.5">
            To
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="h-10 px-3 text-[13px] bg-bg-card border border-border-input rounded-md text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all"
          />
        </div>

        {/* Accounting Method */}
        <div className="flex flex-col gap-1.5">
          <label className="text-[14px] font-medium text-text-primary px-0.5">
            Accounting Method
          </label>
          <div className="flex h-10 bg-bg-page p-1 rounded-lg border border-border w-[180px]">
            <button
              onClick={() => setMethod("cash")}
              className={cn(
                "flex-1 text-[13px] font-medium rounded-md transition-all",
                method === "cash" ? "bg-bg-card text-text-primary shadow-sm border border-border" : "text-text-muted hover:text-text-secondary"
              )}
            >
              Cash
            </button>
            <button
              onClick={() => setMethod("accrual")}
              className={cn(
                "flex-1 text-[13px] font-medium rounded-md transition-all",
                method === "accrual" ? "bg-bg-card text-text-primary shadow-sm border border-border" : "text-text-muted hover:text-text-secondary"
              )}
            >
              Accrual
            </button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 ml-auto">
          <button
            onClick={handleReset}
            className="h-10 px-4 flex items-center gap-2 text-[14px] font-medium text-text-muted border border-border rounded-md hover:bg-bg-page transition-all"
          >
            <RotateCcw size={14} />
            Reset
          </button>
          <button className="h-10 px-5 text-[14px] font-semibold text-white bg-primary rounded-md hover:bg-primary-dark transition-all active:scale-[0.98]">
            Run Report
          </button>
        </div>
      </div>
    </div>
  );
}
