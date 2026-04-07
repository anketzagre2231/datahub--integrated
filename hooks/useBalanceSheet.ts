import { useState, useEffect } from "react";
import { FinancialLine, balanceSheetData } from "@/types/balance-sheet";
import { DetailedFinancialData, balanceSheetDetailData } from "@/types/financial-details";

export function useBalanceSheet() {
  const [isLoading, setIsLoading] = useState(true);
  const [reportData, setReportData] = useState<FinancialLine[]>([]);
  const [detailedData, setDetailedData] = useState<DetailedFinancialData>({ groups: [], grandTotal: 0 });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Using mock data as requested
    setReportData(balanceSheetData);
    setDetailedData(balanceSheetDetailData);
    setIsLoading(false);
    setError(null);
  }, []);

  return { reportData, detailedData, isLoading, error };
}
