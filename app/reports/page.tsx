"use client";

import { useState } from "react";
import Header from "@/components/Header";
import { ChevronDown, FileCheck, Download, FileText, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { FinancialLine } from "@/types/balance-sheet";
import { DetailedFinancialData } from "@/types/financial-details";
import { getBalanceSheet, getBalanceSheetDetail } from "@/services/balanceSheetService";
import { getProfitAndLoss, getProfitAndLossDetail } from "@/services/profitAndLossService";
import { getCashflow, getCashflowDetail } from "@/services/cashflowService";
import { flattenAllReports } from "@/lib/report-utils";
import BalanceSheetReport from "@/components/reports/balance-sheet/BalanceSheetReport";
import ProfitAndLossReport from "@/components/reports/profit-loss/ProfitAndLossReport";
import CashflowReport from "@/components/reports/cashflow/CashflowReport";
import { refreshQuickbooksToken } from "@/services/authService";

function formatDateForInput(date: Date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export default function ReportsPage() {
    const today = new Date();
    const todayString = formatDateForInput(today);
    const [selectedTab, setSelectedTab] = useState<"Balance Sheet" | "Profit & Loss" | "Cashflow">("Balance Sheet");
    const [viewMode, setViewMode] = useState<"generator" | "preview">("generator");
    const [reportType, setReportType] = useState<"Summary" | "Detail">("Summary");
    const [dateRange, setDateRange] = useState("This Month");
    const [customRange, setCustomRange] = useState({
        start: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`,
        end: todayString
    });
    const [accountingMethod, setAccountingMethod] = useState("Accrual");
    const [reportsData, setReportsData] = useState<Record<string, { summary: FinancialLine[]; detail: DetailedFinancialData | null }>>({
        "Balance Sheet": { summary: [], detail: null },
        "Profit & Loss": { summary: [], detail: null },
        "Cashflow": { summary: [], detail: null }
    });
    const [appliedStartDate, setAppliedStartDate] = useState<string>("");
    const [appliedEndDate, setAppliedEndDate] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isDownloadingPDF, setIsDownloadingPDF] = useState(false);
    const [reportFormat, setReportFormat] = useState<"PDF" | "Excel">("PDF");
    const [isSyncing, setIsSyncing] = useState(false);
    const clientName = "All Clients";

    const handleSync = async () => {
        setIsSyncing(true);
        try {
            await refreshQuickbooksToken();
            handleGenerateReport();
        } catch (err) {
            console.error("Sync failed:", err);
            alert("Sync failed. Please try again.");
        } finally {
            setIsSyncing(false);
        }
    };

    const getReportEndpoint = (tab: "Balance Sheet" | "Profit & Loss" | "Cashflow", type: "Summary" | "Detail") => {
        const base = (process.env.NEXT_PUBLIC_API_URL || "/api/backend").replace(/\/$/, "");

        if (tab === "Balance Sheet") {
            return type === "Summary" ? `${base}/balance-sheet` : `${base}/balance-sheet-detail`;
        }

        if (tab === "Profit & Loss") {
            return type === "Summary" ? `${base}/profit-and-loss-statement` : `${base}/profit-and-loss-detail`;
        }

        return type === "Summary" ? `${base}/qb-cashflow` : `${base}/qb-cashflow-engine`;
    };

    const getDates = () => {
        let startDate: string | undefined;
        let endDate: string | undefined;

        if (dateRange === "Custom Range") {
            startDate = customRange.start;
            endDate = customRange.end;
        } else {
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, "0");
            const d = String(now.getDate()).padStart(2, "0");
            endDate = `${y}-${m}-${d}`;

            if (dateRange === "Today") {
                startDate = `${y}-${m}-${d}`;
            } else if (dateRange === "This Month") {
                startDate = `${y}-${m}-01`;
            } else if (dateRange === "This Quarter") {
                const qMonth = String(Math.floor(now.getMonth() / 3) * 3 + 1).padStart(2, "0");
                startDate = `${y}-${qMonth}-01`;
            } else if (dateRange === "This Year") {
                startDate = `${y}-01-01`;
            }
        }
        return { startDate, endDate };
    };

    const handleGenerateReport = async () => {
        setIsLoading(true);
        setViewMode("preview");

        try {
            const { startDate, endDate } = getDates();
            setAppliedStartDate(startDate || "");
            setAppliedEndDate(endDate || "");

            let summary: FinancialLine[] = [];
            let detail: DetailedFinancialData = { groups: [] };

            if (selectedTab === "Balance Sheet") {
                [summary, detail] = await Promise.all([
                    getBalanceSheet(startDate, endDate, accountingMethod).catch(e => { console.error(e); return []; }),
                    getBalanceSheetDetail(startDate, endDate, accountingMethod).catch(e => { console.error(e); return { groups: [] }; })
                ]);
            } else if (selectedTab === "Profit & Loss") {
                [summary, detail] = await Promise.all([
                    getProfitAndLoss(startDate, endDate, accountingMethod).catch(e => { console.error(e); return []; }),
                    getProfitAndLossDetail(startDate, endDate, accountingMethod).catch(e => { console.error(e); return { groups: [] }; })
                ]);
            } else if (selectedTab === "Cashflow") {
                [summary, detail] = await Promise.all([
                    getCashflow(startDate, endDate, accountingMethod).catch(e => { console.error(e); return []; }),
                    getCashflowDetail(startDate, endDate, accountingMethod).catch(e => { console.error(e); return { groups: [] }; })
                ]);
            }

            console.log("[ReportsPage] Final normalized payload before state:", {
                selectedTab,
                reportType,
                summary,
                detail
            });

            setReportsData(prev => ({
                ...prev,
                [selectedTab]: { summary, detail }
            }));
        } catch (error) {
            console.error("[ReportsPage] Generation failed:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDownloadPDF = async () => {
        setIsDownloadingPDF(true);
        try {
            const currentReport = reportsData[selectedTab];
            const dataToExport = reportType === "Summary" 
                ? currentReport.summary 
                : currentReport.detail;

            if (!dataToExport) {
                alert("No active report data found. Please generate the report first.");
                setIsDownloadingPDF(false);
                return;
            }

            const isEmpty = reportType === "Summary" 
                ? (dataToExport as FinancialLine[]).length === 0 
                : !(dataToExport as DetailedFinancialData).groups;

            if (isEmpty) {
                alert("No active report data found. Please generate the report first.");
                setIsDownloadingPDF(false);
                return;
            }

            const { exportToPDF, flattenSummaryData, flattenDetailData } = await import("@/lib/export-utils");
            
            const subtitle = `Report Period: ${appliedStartDate || "N/A"} to ${appliedEndDate || "N/A"} | ${accountingMethod} Basis`;
            const fileName = `${selectedTab.toLowerCase()}-${reportType.toLowerCase()}`;
            
            if (reportType === "Summary") {
                const headers = ["Accounting Classification", "Amount (USD)"];
                const flatData = flattenSummaryData(dataToExport as FinancialLine[]);
                exportToPDF(selectedTab, subtitle, headers, flatData, fileName);
            } else {
                const headers = ["Date", "Type", "Num", "Name", "Memo", "Split", "Amount", "Balance"];
                const flatData = flattenDetailData(dataToExport as DetailedFinancialData);
                exportToPDF(`${selectedTab} Detail`, subtitle, headers, flatData, fileName);
            }
        } catch (error) {
            console.error("PDF generation failed:", error);
            alert("Error: Could not generate dynamic PDF report.");
        } finally {
            setIsDownloadingPDF(false);
        }
    };

    const generateExcel = async () => {
        setIsDownloading(true);
        try {
            const currentReport = reportsData[selectedTab];
            const dataToExport = reportType === "Summary" 
                ? currentReport.summary 
                : currentReport.detail;

            if (!dataToExport) {
                alert("No active report data found. Please generate the report first.");
                setIsDownloading(false);
                return;
            }

            const isEmpty = reportType === "Summary" 
                ? (dataToExport as FinancialLine[]).length === 0 
                : !(dataToExport as DetailedFinancialData).groups;

            if (isEmpty) {
                alert("No active report data found. Please generate the report first.");
                setIsDownloading(false);
                return;
            }

            const { exportToExcel, flattenSummaryData, flattenDetailData } = await import("@/lib/export-utils");
            
            const subtitle = `Report Period: ${appliedStartDate || "N/A"} to ${appliedEndDate || "N/A"} | ${accountingMethod} Basis`;
            const fileName = `${selectedTab.toLowerCase()}-${reportType.toLowerCase()}`;
            
            if (reportType === "Summary") {
                const flatData = flattenSummaryData(dataToExport as FinancialLine[]);
                exportToExcel(selectedTab, subtitle, flatData, fileName);
            } else {
                const flatData = flattenDetailData(dataToExport as DetailedFinancialData);
                exportToExcel(`${selectedTab} Detail`, subtitle, flatData, fileName);
            }
        } catch (error) {
            console.error("Excel generation failed:", error);
            alert("Error: Could not generate complete report.");
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="page-container">
            <Header title="Reports" />

            <div className="page-content">
                <div className="flex items-center justify-between">
                    <h1 className="page-title">Financial Reports</h1>
                    <button
                        onClick={handleSync}
                        disabled={isSyncing}
                        className="btn-secondary"
                    >
                        <RefreshCw size={16} className={isSyncing ? "animate-spin" : ""} />
                        {isSyncing ? "Syncing..." : "Sync"}
                    </button>
                </div>

                {/* Tabs — matching reference segmented style */}
                <div className="flex gap-6 mb-6 border-b border-border pb-px">
                    {(["Balance Sheet", "Profit & Loss", "Cashflow"] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => {
                                setSelectedTab(tab);
                                const currentReport = reportsData[tab];
                                if ((currentReport?.summary?.length ?? 0) > 0 || (currentReport?.detail?.groups?.length ?? 0) > 0) {
                                    setViewMode("preview");
                                } else {
                                    setViewMode("generator");
                                }
                            }}
                            className={cn(
                                "relative pb-3 text-[14px] font-medium transition-all",
                                selectedTab === tab
                                    ? "text-text-primary font-semibold after:content-[''] after:absolute after:bottom-[-1px] after:left-0 after:w-full after:h-[2px] after:bg-primary after:rounded-full"
                                    : "text-text-muted hover:text-text-secondary"
                            )}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Main Card */}
                <div className="card-base card-p">
                    {/* Content Header */}
                    <div className="flex flex-col gap-1 mb-5">
                        <h2 className="text-[18px] font-semibold text-text-primary">{selectedTab}</h2>
                        <p className="text-[14px] text-text-muted">
                            Generate reports about your company financial position, performance, and trends.
                        </p>
                    </div>

                    {/* View Switcher Controls — matching reference pill tabs */}
                    <div className="flex bg-bg-page p-1 rounded-lg border border-border w-fit mb-6">
                        <button
                            onClick={() => setViewMode("generator")}
                            className={cn(
                                "px-5 py-2 rounded-md text-[14px] font-medium transition-all",
                                viewMode === "generator" ? "bg-bg-card text-text-primary shadow-sm border border-border" : "text-text-muted hover:text-text-secondary"
                            )}
                        >
                            Generate Report
                        </button>
                        <button
                            onClick={() => setViewMode("preview")}
                            className={cn(
                                "px-5 py-2 rounded-md text-[14px] font-medium transition-all",
                                viewMode === "preview" ? "bg-bg-card text-text-primary shadow-sm border border-border" : "text-text-muted hover:text-text-secondary"
                            )}
                        >
                            Preview Report
                        </button>
                    </div>

                    {viewMode === "generator" ? (
                        /* Generator Form - Centered 2-Column Layout */
                        <div className="max-w-2xl mx-auto space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                                {/* Left Column */}
                                <div className="space-y-5">
                                    {/* Report Type */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[14px] font-medium text-text-primary">Report Type</label>
                                        <div className="relative">
                                            <select
                                                value={reportType}
                                                onChange={(e) => setReportType(e.target.value as "Summary" | "Detail")}
                                                className="w-full h-10 pl-3 pr-10 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                                            >
                                                <option value="Summary">Summary</option>
                                                <option value="Detail">Detail</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Date Range */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[14px] font-medium text-text-primary">Date Range</label>
                                        <div className="flex flex-col gap-3">
                                            <div className="relative">
                                                <select
                                                    value={dateRange}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setDateRange(val);
                                                        if (val === "This Year") {
                                                            const currentYear = new Date().getFullYear();
                                                            setCustomRange({ start: `${currentYear}-01-01`, end: todayString });
                                                        }
                                                    }}
                                                    className="w-full h-10 pl-3 pr-10 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                                                >
                                                    <option>Today</option>
                                                    <option>This Month</option>
                                                    <option>This Quarter</option>
                                                    <option>This Year</option>
                                                    <option>Custom Range</option>
                                                </select>
                                                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                            </div>

                                            {dateRange === "Custom Range" && (
                                                <div className="flex items-end gap-3 translate-y-1">
                                                    <div className="flex-1 flex flex-col gap-1.5">
                                                        <span className="text-[12px] text-text-muted">From</span>
                                                        <input
                                                            type="date"
                                                            value={customRange.start}
                                                            onChange={(e) => setCustomRange({ ...customRange, start: e.target.value })}
                                                            className="h-10 px-3 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                                        />
                                                    </div>
                                                    <div className="flex-1 flex flex-col gap-1.5">
                                                        <span className="text-[12px] text-text-muted">To</span>
                                                        <input
                                                            type="date"
                                                            value={customRange.end}
                                                            onChange={(e) => setCustomRange({ ...customRange, end: e.target.value })}
                                                            className="h-10 px-3 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column */}
                                <div className="space-y-5">
                                    {/* Accounting Method */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[14px] font-medium text-text-primary">Accounting Method</label>
                                        <div className="relative">
                                            <select
                                                value={accountingMethod}
                                                onChange={(e) => setAccountingMethod(e.target.value)}
                                                className="w-full h-10 pl-3 pr-10 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                                            >
                                                <option>Cash</option>
                                                <option>Accrual</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                        </div>
                                    </div>

                                    {/* Report Format */}
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-[14px] font-medium text-text-primary">Report Format</label>
                                        <div className="relative">
                                            <select
                                                value={reportFormat}
                                                onChange={(e) => setReportFormat(e.target.value as "PDF" | "Excel")}
                                                className="w-full h-10 pl-3 pr-10 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary appearance-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all cursor-pointer"
                                            >
                                                <option value="PDF">PDF</option>
                                                <option value="Excel">Excel (CSV)</option>
                                            </select>
                                            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Full-width Generate Button */}
                            <button
                                onClick={handleGenerateReport}
                                disabled={isLoading}
                                className={cn("btn-primary w-full mt-4", isLoading && "opacity-80 cursor-wait")}
                            >
                                {isLoading ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        <span>Generating...</span>
                                    </div>
                                ) : (
                                    <>
                                        <FileCheck size={16} />
                                        Generate Report
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        /* Preview Mode */
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                            {isLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center bg-bg-page card-base border border-border py-12">
                                    <div className="w-12 h-12 rounded-full border-4 border-border border-t-primary animate-spin mb-4" />
                                    <p className="text-[13px] text-text-muted animate-pulse font-medium">Analyzing real-time financial data...</p>
                                </div>
                            ) : (
                                selectedTab === "Balance Sheet" ? (
                                    <BalanceSheetReport
                                        reportType={reportType}
                                        data={reportsData[selectedTab].summary}
                                        detailedData={reportsData[selectedTab].detail || { groups: [] }}
                                        startDate={appliedStartDate}
                                        endDate={appliedEndDate}
                                        accountingMethod={accountingMethod}
                                        clientName={clientName}
                                    />
                                ) : selectedTab === "Profit & Loss" ? (
                                    <ProfitAndLossReport
                                        reportType={reportType}
                                        data={reportsData[selectedTab].summary}
                                        detailedData={reportsData[selectedTab].detail || { groups: [] }}
                                        startDate={appliedStartDate}
                                        endDate={appliedEndDate}
                                        accountingMethod={accountingMethod}
                                        clientName={clientName}
                                    />
                                ) : (
                                    <CashflowReport
                                        reportType={reportType}
                                        data={reportsData[selectedTab].summary}
                                        detailedData={reportsData[selectedTab].detail || { groups: [] }}
                                        startDate={appliedStartDate}
                                        endDate={appliedEndDate}
                                        accountingMethod={accountingMethod}
                                        clientName={clientName}
                                    />
                                )
                            )}

                            {/* Actions bar */}
                            <div className="flex items-center justify-end gap-3 mt-6">
                                <button
                                    onClick={() => setViewMode("generator")}
                                    className="btn-secondary"
                                >
                                    Back to Generator
                                </button>

                                {reportFormat === "Excel" ? (
                                    <button
                                        onClick={() => generateExcel()}
                                        disabled={isDownloading}
                                        className={cn(
                                            "btn-primary shadow-md min-w-[160px]",
                                            isDownloading && "opacity-80 cursor-wait"
                                        )}
                                    >
                                        {isDownloading ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Processing...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Download size={16} />
                                                Download Excel
                                            </>
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={handleDownloadPDF}
                                        disabled={isDownloadingPDF}
                                        className={cn(
                                            "btn-primary shadow-md min-w-[160px]",
                                            isDownloadingPDF && "opacity-80 cursor-wait"
                                        )}
                                    >
                                        {isDownloadingPDF ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Processing...</span>
                                            </div>
                                        ) : (
                                            <>
                                                <FileText size={16} />
                                                Download PDF
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

