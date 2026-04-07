"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import { cn } from "@/lib/utils";
import {
  FileText,
  TrendingUp,
  PieChart,
  Search,
  ChevronDown,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  fetchDashboardKPIs,
  fetchFinancialTrends,
} from "@/services/reportService";
import { fetchCustomers } from "@/services/customerService";
import { fetchInvoices } from "@/services/invoiceService";
import { getProfitAndLoss } from "@/services/profitAndLossService";
import { refreshQuickbooksToken } from "@/services/authService";
import { exportToCSV } from "@/lib/exportCSV";

// Aggregation types
const AGGREGATION_TYPES = [
  { label: "Monthly", value: "monthly", icon: CalendarDays },
  { label: "Quarterly", value: "quarterly", icon: BarChart3 },
];

// Generate year options (last 5 years and next 1 year)
const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 1; i++) {
    years.push(i);
  }
  return years;
};

// Month options
const MONTHS = [
  { value: "1", label: "January" },
  { value: "2", label: "February" },
  { value: "3", label: "March" },
  { value: "4", label: "April" },
  { value: "5", label: "May" },
  { value: "6", label: "June" },
  { value: "7", label: "July" },
  { value: "8", label: "August" },
  { value: "9", label: "September" },
  { value: "10", label: "October" },
  { value: "11", label: "November" },
  { value: "12", label: "December" },
];

export default function DashboardPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [dynamicStats, setDynamicStats] = useState<any[]>([]);
  const [customersData, setCustomersData] = useState<any[]>([]);
  const [invoicesData, setInvoicesData] = useState<any[]>([]);
  const [chartDataState, setChartDataState] = useState<any[]>([]);
  const [isChartLoading, setIsChartLoading] = useState(false);
  const [monthlyInsights, setMonthlyInsights] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

  // ── KPI / main filter ──────────────────────────────────────────────────────
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [selectedMonth, setSelectedMonth] = useState<string>("");
  const [filterType, setFilterType] = useState<"yearMonth" | "custom">(
    "yearMonth",
  );

  // ── Chart-specific filter (independent) ───────────────────────────────────
  const [chartStartDate, setChartStartDate] = useState<string>("");
  const [chartEndDate, setChartEndDate] = useState<string>("");
  const [chartSelectedYear, setChartSelectedYear] = useState<number>(
    new Date().getFullYear(),
  );
  const [chartSelectedMonth, setChartSelectedMonth] = useState<string>("");
  const [aggregationType, setAggregationType] = useState<
    "monthly" | "quarterly"
  >("monthly");
  const [isSyncing, setIsSyncing] = useState(false);

  // ── Sync handler ──────────────────────────────────────────────────────────
  const handleSync = useCallback(async () => {
    setIsSyncing(true);
    try {
      await refreshQuickbooksToken();
      await loadKpiData();
      await loadChartData(chartStartDate, chartEndDate, aggregationType);
    } catch (err) {
      console.error("Sync failed:", err);
    } finally {
      setIsSyncing(false);
    }
  }, [chartStartDate, chartEndDate, aggregationType]);

  // ── Helpers ────────────────────────────────────────────────────────────────
  const calculateDateRangeFromYearMonth = useCallback(
    (year: number, month?: string) => {
      if (month) {
        const monthNum = parseInt(month);
        const start = new Date(year, monthNum - 1, 1);
        const end = new Date(year, monthNum, 0);
        return {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        };
      } else {
        const start = new Date(year, 0, 1);
        const end = new Date(year, 11, 31);
        return {
          startDate: start.toISOString().split("T")[0],
          endDate: end.toISOString().split("T")[0],
        };
      }
    },
    [],
  );

  // ── Load chart data only ───────────────────────────────────────────────────
  const loadChartData = useCallback(
    async (
      start: string,
      end: string,
      aggType: "monthly" | "quarterly" = "monthly",
    ) => {
      setIsChartLoading(true);
      try {
        console.log("[loadChartData]", { start, end, aggType });
        const data = await fetchFinancialTrends(start, end, aggType);
        setChartDataState(data);
      } catch (err) {
        console.error("Failed to load chart data:", err);
        setChartDataState([]);
      } finally {
        setIsChartLoading(false);
      }
    },
    [],
  );

  // ── Load KPI + invoices/customers (main filter) ────────────────────────────
  const loadKpiData = useCallback(async (start?: string, end?: string) => {
    setIsLoading(true);
    try {
      const [kpiData, custsData, invsData] = await Promise.all([
        fetchDashboardKPIs(start, end),
        fetchCustomers(),
        fetchInvoices(),
      ]);

      const custs = Array.isArray(custsData?.QueryResponse?.Customer)
        ? custsData.QueryResponse.Customer
        : Array.isArray(custsData?.data?.QueryResponse?.Customer)
          ? custsData.data.QueryResponse.Customer
          : Array.isArray(custsData)
            ? custsData
            : [];

      const invs = Array.isArray(invsData?.QueryResponse?.Invoice)
        ? invsData.QueryResponse.Invoice
        : Array.isArray(invsData?.data?.QueryResponse?.Invoice)
          ? invsData.data.QueryResponse.Invoice
          : Array.isArray(invsData)
            ? invsData
            : [];

      setCustomersData(custs);
      setInvoicesData(invs);
      setDynamicStats(kpiData);

      const totalRevenue =
        kpiData.find((k) => k.label === "Total Revenue")?.rawValue || 0;
      const totalExpenses =
        kpiData.find((k) => k.label === "Total Expenses")?.rawValue || 0;
      const accountsPayable =
        kpiData.find((k) => k.label === "Account Payable")?.rawValue || 0;
      const cashBank =
        kpiData.find((k) => k.label === "Cash & Bank Balance")?.rawValue || 0;

      const margin =
        totalRevenue > 0
          ? ((totalRevenue - totalExpenses) / totalRevenue) * 100
          : 0;

      const formatCurrency = (num: number) =>
        "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });

      setMonthlyInsights([
        {
          label: "Operating Margin",
          value: margin.toFixed(1) + "%",
          color: "#8bc53d",
          desc:
            margin > 20
              ? "Healthy profit range"
              : margin > 10
                ? "Moderate margin"
                : "Monitor expenses",
        },
        {
          label: "Account Payable",
          value: formatCurrency(accountsPayable),
          color: "#F68C1F",
          desc: "Current liabilities to vendors",
        },
        {
          label: "Cash on Hand",
          value: formatCurrency(cashBank),
          color: "#00648F",
          desc: "Liquid bank balance available",
        },
      ]);
    } catch (err) {
      console.error("Failed to load dashboard KPI data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── KPI filter handlers (unchanged behaviour) ──────────────────────────────
  const handleYearMonthChange = () => {
    const { startDate: newStart, endDate: newEnd } =
      calculateDateRangeFromYearMonth(selectedYear, selectedMonth);
    setStartDate(newStart);
    setEndDate(newEnd);
    setFilterType("yearMonth");
    loadKpiData(newStart, newEnd);
  };

  const handleCustomDateChange = () => {
    if (startDate && endDate) {
      setFilterType("custom");
      loadKpiData(startDate, endDate);
    }
  };

  const handlePreviousYear = () => {
    const newYear = selectedYear - 1;
    setSelectedYear(newYear);
    if (filterType === "yearMonth") {
      const { startDate: newStart, endDate: newEnd } =
        calculateDateRangeFromYearMonth(newYear, selectedMonth || undefined);
      setStartDate(newStart);
      setEndDate(newEnd);
      loadKpiData(newStart, newEnd);
    }
  };

  const handleNextYear = () => {
    const newYear = selectedYear + 1;
    setSelectedYear(newYear);
    if (filterType === "yearMonth") {
      const { startDate: newStart, endDate: newEnd } =
        calculateDateRangeFromYearMonth(newYear, selectedMonth || undefined);
      setStartDate(newStart);
      setEndDate(newEnd);
      loadKpiData(newStart, newEnd);
    }
  };

  const handlePreviousMonth = () => {
    if (selectedMonth) {
      let newMonth = parseInt(selectedMonth) - 1;
      let newYear = selectedYear;
      if (newMonth < 1) {
        newMonth = 12;
        newYear = selectedYear - 1;
      }
      setSelectedYear(newYear);
      setSelectedMonth(newMonth.toString());
      const { startDate: newStart, endDate: newEnd } =
        calculateDateRangeFromYearMonth(newYear, newMonth.toString());
      setStartDate(newStart);
      setEndDate(newEnd);
      loadKpiData(newStart, newEnd);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth) {
      let newMonth = parseInt(selectedMonth) + 1;
      let newYear = selectedYear;
      if (newMonth > 12) {
        newMonth = 1;
        newYear = selectedYear + 1;
      }
      setSelectedYear(newYear);
      setSelectedMonth(newMonth.toString());
      const { startDate: newStart, endDate: newEnd } =
        calculateDateRangeFromYearMonth(newYear, newMonth.toString());
      setStartDate(newStart);
      setEndDate(newEnd);
      loadKpiData(newStart, newEnd);
    }
  };

  // ── Chart filter handlers ──────────────────────────────────────────────────
  const handleChartPreviousYear = () => {
    const newYear = chartSelectedYear - 1;
    setChartSelectedYear(newYear);
    const { startDate: newStart, endDate: newEnd } =
      calculateDateRangeFromYearMonth(newYear, chartSelectedMonth || undefined);
    setChartStartDate(newStart);
    setChartEndDate(newEnd);
    loadChartData(newStart, newEnd, aggregationType);
  };

  const handleChartNextYear = () => {
    const newYear = chartSelectedYear + 1;
    setChartSelectedYear(newYear);
    const { startDate: newStart, endDate: newEnd } =
      calculateDateRangeFromYearMonth(newYear, chartSelectedMonth || undefined);
    setChartStartDate(newStart);
    setChartEndDate(newEnd);
    loadChartData(newStart, newEnd, aggregationType);
  };

  const handleChartPreviousMonth = () => {
    if (chartSelectedMonth) {
      let newMonth = parseInt(chartSelectedMonth) - 1;
      let newYear = chartSelectedYear;
      if (newMonth < 1) {
        newMonth = 12;
        newYear = chartSelectedYear - 1;
      }
      setChartSelectedYear(newYear);
      setChartSelectedMonth(newMonth.toString());
      const { startDate: newStart, endDate: newEnd } =
        calculateDateRangeFromYearMonth(newYear, newMonth.toString());
      setChartStartDate(newStart);
      setChartEndDate(newEnd);
      loadChartData(newStart, newEnd, aggregationType);
    }
  };

  const handleChartNextMonth = () => {
    if (chartSelectedMonth) {
      let newMonth = parseInt(chartSelectedMonth) + 1;
      let newYear = chartSelectedYear;
      if (newMonth > 12) {
        newMonth = 1;
        newYear = chartSelectedYear + 1;
      }
      setChartSelectedYear(newYear);
      setChartSelectedMonth(newMonth.toString());
      const { startDate: newStart, endDate: newEnd } =
        calculateDateRangeFromYearMonth(newYear, newMonth.toString());
      setChartStartDate(newStart);
      setChartEndDate(newEnd);
      loadChartData(newStart, newEnd, aggregationType);
    }
  };

  const handleChartApply = () => {
    const { startDate: newStart, endDate: newEnd } =
      calculateDateRangeFromYearMonth(
        chartSelectedYear,
        chartSelectedMonth || undefined,
      );
    setChartStartDate(newStart);
    setChartEndDate(newEnd);
    loadChartData(newStart, newEnd, aggregationType);
  };

  const handleAggregationChange = (type: "monthly" | "quarterly") => {
    setAggregationType(type);
    loadChartData(chartStartDate, chartEndDate, type);
  };

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    setIsClient(true);
    const currentYear = new Date().getFullYear();
    const currentMonth = (new Date().getMonth() + 1).toString();

    // 1. KPI filter setup
    setSelectedYear(currentYear);
    setSelectedMonth(currentMonth);
    const { startDate: kpiStart, endDate: kpiEnd } =
      calculateDateRangeFromYearMonth(currentYear, currentMonth);
    setStartDate(kpiStart);
    setEndDate(kpiEnd);

    // 2. Chart filter setup
    setChartSelectedYear(currentYear);
    setChartSelectedMonth("");
    const { startDate: chartStart, endDate: chartEnd } =
      calculateDateRangeFromYearMonth(currentYear);
    setChartStartDate(chartStart);
    setChartEndDate(chartEnd);

    // Load sequentially — Prevents 429 errors from firing 14+ requests simultaneously
    const loadSequential = async () => {
      await loadKpiData(kpiStart, kpiEnd);
      await loadChartData(chartStart, chartEnd, "monthly");
    };
    loadSequential();
  }, [loadKpiData, loadChartData, calculateDateRangeFromYearMonth]);

  const handleExportTrendsCSV = () => {
    const headers =
      aggregationType === "monthly"
        ? ["Month", "Revenue", "Expenses"]
        : ["Quarter", "Revenue", "Expenses"];

    exportToCSV(
      chartDataState,
      headers,
      `financial_trends_${aggregationType}`,
      (item) => [item.name, item.revenue.toFixed(2), item.expenses.toFixed(2)],
    );
  };

  return (
    <>
      <Header title="Dashboard" />
      <div className="flex-1 p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-bold text-text-primary">Dashboard</h1>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className="btn-secondary py-1.5 px-3"
              title="Sync data"
            >
              <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
            </button>
          </div>

          {/* KPI Filter Section */}
          <div className="flex items-center gap-4 flex-wrap">
            {/* Year/Month Filter */}
            <div className="flex items-center gap-2 bg-bg-page rounded-lg border border-border p-2">
              {/* Year Navigation */}
              <button
                onClick={handlePreviousYear}
                className="p-1.5 hover:bg-bg-page/80 rounded-md transition-colors"
                title="Previous Year"
              >
                <ChevronLeft size={16} className="text-text-secondary" />
              </button>

              <select
                value={selectedYear}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value);
                  setSelectedYear(newYear);
                  if (filterType === "yearMonth") {
                    const { startDate: newStart, endDate: newEnd } =
                      calculateDateRangeFromYearMonth(
                        newYear,
                        selectedMonth || undefined,
                      );
                    setStartDate(newStart);
                    setEndDate(newEnd);
                    loadKpiData(newStart, newEnd);
                  }
                }}
                className="px-3 py-1.5 text-[13px] font-medium bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {generateYearOptions().map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextYear}
                className="p-1.5 hover:bg-bg-page/80 rounded-md transition-colors"
                title="Next Year"
              >
                <ChevronRight size={16} className="text-text-secondary" />
              </button>

              <div className="w-px h-6 bg-border mx-1" />

              <button
                onClick={handlePreviousMonth}
                className="p-1.5 hover:bg-bg-page/80 rounded-md transition-colors"
                title="Previous Month"
                disabled={!selectedMonth}
              >
                <ChevronLeft
                  size={16}
                  className={cn(!selectedMonth && "opacity-30")}
                />
              </button>

              <select
                value={selectedMonth}
                onChange={(e) => {
                  const newMonth = e.target.value;
                  setSelectedMonth(newMonth);
                  const { startDate: newStart, endDate: newEnd } =
                    calculateDateRangeFromYearMonth(
                      selectedYear,
                      newMonth || undefined,
                    );
                  setStartDate(newStart);
                  setEndDate(newEnd);
                  setFilterType("yearMonth");
                  loadKpiData(newStart, newEnd);
                }}
                className="px-3 py-1.5 text-[13px] font-medium bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Full Year</option>
                {MONTHS.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-bg-page/80 rounded-md transition-colors"
                title="Next Month"
                disabled={!selectedMonth}
              >
                <ChevronRight
                  size={16}
                  className={cn(!selectedMonth && "opacity-30")}
                />
              </button>

              <button
                onClick={handleYearMonthChange}
                className="ml-2 px-3 py-1.5 text-[13px] font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
              >
                Apply
              </button>
            </div>

            <div className="text-text-muted text-[13px]">or</div>

            {/* Custom Date Range */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-base py-1.5 text-[13px]"
                />
              </div>
              <span className="text-text-muted">to</span>
              <div className="relative">
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="input-base py-1.5 text-[13px]"
                />
              </div>
              <button
                onClick={handleCustomDateChange}
                className="btn-secondary py-1.5 px-3 text-[13px]"
              >
                Apply
              </button>
            </div>
          </div>
        </div>

        {/* Stats Row - 12 Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {dynamicStats.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={i}
                className={cn(
                  "card-base card-p transition-opacity duration-300",
                  isLoading ? "opacity-0" : "opacity-100",
                )}
                style={{ transitionDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[14px] font-medium text-text-secondary">
                    {stat.label}
                  </span>
                  <Icon
                    size={18}
                    style={{ color: stat.color }}
                    strokeWidth={2}
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <p className="text-[24px] font-bold text-text-primary leading-none tracking-tight">
                    {isLoading ? (
                      <span className="skeleton inline-block h-8 w-24 rounded-md" />
                    ) : (
                      stat.value
                    )}
                  </p>

                  <p className="text-[12px] text-text-muted mt-1">
                    {stat.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Dashboard Grid */}
        <div className="grid grid-cols-12 gap-4">
          {/* Revenue vs Expenses Chart */}
          <div className="col-span-12 lg:col-span-8 card-base card-p flex flex-col">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-[18px] font-semibold text-text-primary">
                Financial Trends
              </h3>

              <div className="flex items-center gap-2 flex-wrap">
                {/* ── Chart-specific date filter ── */}
                <div className="flex items-center gap-1.5 bg-bg-page rounded-lg border border-border p-1.5">
                  {/* Year nav */}
                  <button
                    onClick={handleChartPreviousYear}
                    className="p-1 hover:bg-bg-page/80 rounded-md transition-colors"
                    title="Previous Year"
                  >
                    <ChevronLeft size={14} className="text-text-secondary" />
                  </button>

                  <select
                    value={chartSelectedYear}
                    onChange={(e) => {
                      const newYear = parseInt(e.target.value);
                      setChartSelectedYear(newYear);
                      const { startDate: newStart, endDate: newEnd } =
                        calculateDateRangeFromYearMonth(
                          newYear,
                          chartSelectedMonth || undefined,
                        );
                      setChartStartDate(newStart);
                      setChartEndDate(newEnd);
                      loadChartData(newStart, newEnd, aggregationType);
                    }}
                    className="px-2 py-1 text-[12px] font-medium bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    {generateYearOptions().map((year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleChartNextYear}
                    className="p-1 hover:bg-bg-page/80 rounded-md transition-colors"
                    title="Next Year"
                  >
                    <ChevronRight size={14} className="text-text-secondary" />
                  </button>

                  <div className="w-px h-5 bg-border mx-0.5" />

                  {/* Month nav */}
                  <button
                    onClick={handleChartPreviousMonth}
                    className="p-1 hover:bg-bg-page/80 rounded-md transition-colors"
                    title="Previous Month"
                    disabled={!chartSelectedMonth}
                  >
                    <ChevronLeft
                      size={14}
                      className={cn(
                        "text-text-secondary",
                        !chartSelectedMonth && "opacity-30",
                      )}
                    />
                  </button>

                  <select
                    value={chartSelectedMonth}
                    onChange={(e) => {
                      const newMonth = e.target.value;
                      setChartSelectedMonth(newMonth);
                      const { startDate: newStart, endDate: newEnd } =
                        calculateDateRangeFromYearMonth(
                          chartSelectedYear,
                          newMonth || undefined,
                        );
                      setChartStartDate(newStart);
                      setChartEndDate(newEnd);
                      loadChartData(newStart, newEnd, aggregationType);
                    }}
                    className="px-2 py-1 text-[12px] font-medium bg-transparent border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="">Full Year</option>
                    {MONTHS.map((month) => (
                      <option key={month.value} value={month.value}>
                        {month.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={handleChartNextMonth}
                    className="p-1 hover:bg-bg-page/80 rounded-md transition-colors"
                    title="Next Month"
                    disabled={!chartSelectedMonth}
                  >
                    <ChevronRight
                      size={14}
                      className={cn(
                        "text-text-secondary",
                        !chartSelectedMonth && "opacity-30",
                      )}
                    />
                  </button>

                  <button
                    onClick={handleChartApply}
                    className="ml-1 px-2 py-1 text-[12px] font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors"
                  >
                    Apply
                  </button>
                </div>

                {/* Aggregation toggle */}
                <div className="flex items-center gap-1 bg-bg-page rounded-lg border border-border p-1">
                  {AGGREGATION_TYPES.map((type) => {
                    const Icon = type.icon;
                    return (
                      <button
                        key={type.value}
                        onClick={() =>
                          handleAggregationChange(
                            type.value as "monthly" | "quarterly",
                          )
                        }
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium rounded-md transition-colors",
                          aggregationType === type.value
                            ? "bg-primary text-white"
                            : "text-text-secondary hover:text-text-primary hover:bg-bg-page/80",
                        )}
                      >
                        <Icon size={14} />
                        {type.label}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={handleExportTrendsCSV}
                  className="btn-secondary h-auto py-1.5 text-[13px]"
                >
                  Export CSV
                </button>
              </div>
            </div>

            <div className="h-[300px] w-full mt-auto">
              {isClient && !isChartLoading && chartDataState.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartDataState}
                    margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="var(--color-border-light)"
                    />
                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--color-text-muted)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      dy={10}
                      angle={
                        aggregationType === "monthly" &&
                          chartDataState.length > 6
                          ? -45
                          : 0
                      }
                      textAnchor={
                        aggregationType === "monthly" &&
                          chartDataState.length > 6
                          ? "end"
                          : "middle"
                      }
                      height={
                        aggregationType === "monthly" &&
                          chartDataState.length > 6
                          ? 60
                          : 30
                      }
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fill: "var(--color-text-muted)",
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                      tickFormatter={(value) =>
                        `$${(value / 1000).toFixed(0)}k`
                      }
                    />
                    <Tooltip
                      cursor={{ fill: "var(--color-bg-page)", radius: 4 }}
                      contentStyle={{
                        borderRadius: "8px",
                        border: "1px solid var(--color-border)",
                        boxShadow: "var(--shadow-card)",
                        fontSize: "13px",
                        padding: "10px 14px",
                      }}
                      formatter={(value) => {
                        const num = typeof value === 'number' ? value : 0;
                        return [`$${num.toLocaleString()}`, undefined] as [string, undefined];
                      }}
                    />
                    <Legend
                      verticalAlign="top"
                      align="right"
                      iconType="circle"
                      wrapperStyle={{
                        paddingBottom: "16px",
                        fontSize: "12px",
                        fontWeight: 500,
                      }}
                    />
                    <Bar
                      name="Revenue"
                      dataKey="revenue"
                      fill="var(--color-primary)"
                      radius={[4, 4, 0, 0]}
                      barSize={aggregationType === "quarterly" ? 40 : 24}
                    />
                    <Bar
                      name="Expenses"
                      dataKey="expenses"
                      fill="var(--color-negative)"
                      fillOpacity={0.7}
                      radius={[4, 4, 0, 0]}
                      barSize={aggregationType === "quarterly" ? 40 : 24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full flex items-center justify-center p-8">
                  <div className="w-full h-full bg-bg-page/50 rounded-lg flex items-center justify-center border border-dashed border-border">
                    <TrendingUp
                      className="text-text-muted animate-pulse"
                      size={32}
                    />
                    <span className="ml-2 text-text-muted">
                      {isChartLoading
                        ? "Loading chart data..."
                        : "No data available"}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Performance Summary / Insights */}
          <div className="col-span-12 lg:col-span-4 card-base card-p flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[18px] font-semibold text-text-primary">
                Key Insights
              </h3>
              <PieChart size={18} className="text-primary" />
            </div>

            <div className="flex-1 space-y-3">
              {monthlyInsights.map((item, i) => (
                <div
                  key={i}
                  className="p-4 rounded-lg bg-bg-page/50 hover:bg-bg-page transition-all"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-medium text-text-muted">
                      {item.label}
                    </span>
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                  </div>
                  <p className="text-[20px] font-bold text-text-primary mb-0.5">
                    {item.value}
                  </p>
                  <p className="text-[12px] text-text-muted">{item.desc}</p>
                </div>
              ))}
            </div>

            <button className="btn-secondary w-full mt-5 py-2.5">
              Comprehensive Audit Info
            </button>
          </div>

          {/* Recent Invoices - Full Width Table */}
          <div className="col-span-12 card-base card-p">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
              <h3 className="text-[18px] font-semibold text-text-primary">
                Recent Invoices
              </h3>

              <div className="flex items-center gap-3">
                <div className="relative w-[280px]">
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Search size={16} className="text-text-muted" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search invoices..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="input-base pl-10 h-10"
                  />
                </div>

                <Link href="/invoices">
                  <button className="btn-primary">
                    View All
                    <ChevronDown size={16} />
                  </button>
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-bg-page/50">
                    <th className="py-3 px-6 text-[14px] font-medium text-text-muted">
                      Invoice & Date
                    </th>
                    <th className="py-3 px-4 text-[14px] font-medium text-text-muted">
                      Client
                    </th>
                    <th className="py-3 px-4 text-[14px] font-medium text-text-muted">
                      Due Date
                    </th>
                    <th className="py-3 px-4 text-[14px] font-medium text-text-muted text-right">
                      Amount
                    </th>
                    <th className="py-3 px-4 text-[14px] font-medium text-text-muted text-right">
                      Balance
                    </th>
                    <th className="py-3 px-4 text-[14px] font-medium text-text-muted text-center w-[100px]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading
                    ? Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={6} className="py-4 px-4">
                          <div className="skeleton h-8 w-full rounded-md" />
                        </td>
                      </tr>
                    ))
                    : invoicesData
                      .filter((inv: any) => {
                        const s = searchTerm.toLowerCase();
                        const idMatch = (inv.DocNumber || inv.id || "")
                          .toLowerCase()
                          .includes(s);
                        const customerMatch = (
                          inv.CustomerRef?.name ||
                          inv.customer ||
                          ""
                        )
                          .toLowerCase()
                          .includes(s);
                        return idMatch || customerMatch;
                      })
                      .slice(0, 5)
                      .map((inv: any, i: number) => {
                        const amount = inv.TotalAmt || inv.amount || 0;
                        const balance = inv.Balance || inv.balance || 0;

                        let status = "open";
                        if (balance === 0) status = "paid";
                        else if (
                          inv.DueDate &&
                          new Date(inv.DueDate) < new Date()
                        )
                          status = "overdue";

                        const statusConfig = (s: string) => {
                          const cfgs: any = {
                            paid: {
                              label: "Paid",
                              icon: CheckCircle2,
                              color: "bg-[#8bc53d] text-white",
                            },
                            open: {
                              label: "Open",
                              icon: Clock,
                              color: "bg-[#00648F] text-white",
                            },
                            overdue: {
                              label: "Overdue",
                              icon: AlertCircle,
                              color: "bg-[#C62026] text-white",
                            },
                            draft: {
                              label: "Draft",
                              icon: FileText,
                              color: "bg-[#6D6E71] text-white",
                            },
                          };
                          return cfgs[s.toLowerCase()] || cfgs.open;
                        };
                        const config = statusConfig(status);

                        return (
                          <tr
                            key={inv.id || i}
                            className="group hover:bg-bg-page/50 transition-colors"
                          >
                            <td className="py-3 px-6">
                              <div className="flex flex-col">
                                <span className="text-[14px] font-medium text-text-primary">
                                  #
                                  {inv.DocNumber ||
                                    inv.id ||
                                    `INV-00${i + 1}`}
                                </span>
                                <span className="text-[12px] text-text-muted">
                                  {new Date(
                                    inv.MetaData?.CreateTime ||
                                    inv.date ||
                                    Date.now(),
                                  ).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 px-4 text-[14px] text-text-secondary">
                              {inv.CustomerRef?.name ||
                                inv.customer ||
                                "Unknown Client"}
                            </td>
                            <td className="py-3 px-4 text-[14px] text-text-secondary">
                              {inv.DueDate || inv.dueDate || "N/A"}
                            </td>
                            <td className="py-3 px-4 text-right text-[14px] font-semibold text-text-primary tabular-nums">
                              $
                              {amount.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-3 px-4 text-right text-[14px] font-medium text-text-primary tabular-nums">
                              $
                              {balance.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                              })}
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div
                                className={cn(
                                  "inline-flex items-center justify-center px-4 py-1.5 rounded-full text-[12px] font-bold capitalize min-w-[80px]",
                                  config.color,
                                )}
                              >
                                {config.label}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
