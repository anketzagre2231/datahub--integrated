"use client";

import { Bell, Sparkles, ChevronDown, AlertCircle, Zap, Building2 } from "lucide-react";
import { useEffect, useState } from "react";
import { getConnectionStatus, connectQuickbooks } from "@/services/authService";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  const [currentTime, setCurrentTime] = useState("");
  const [currentDate, setCurrentDate] = useState("");
  const [isConnected, setIsConnected] = useState<boolean | null>(true); // default true to avoid flash
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState("Sage Healthy");

  useEffect(() => {
    let mounted = true;
    const checkStatus = async () => {
      try {
        const data = await getConnectionStatus();
        if (mounted) setIsConnected(data.isConnected);
      } catch (err) {
        if (mounted) setIsConnected(false);
      }
    };
    checkStatus();

    const update = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        })
      );
      setCurrentDate(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      );
    };
    update();
    const interval = setInterval(update, 1000);
    return () => {
      clearInterval(interval);
      mounted = false;
    };
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-bg-card border-b border-border">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Left: Date/Time & Title */}
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-text-muted font-medium">
              {currentDate}
            </span>
            <span className="text-[13px] text-text-muted tabular-nums font-medium">{currentTime}</span>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          {isConnected === false && (
            <div className="flex items-center gap-3 bg-negative-bg/40 px-3 py-1.5 rounded-lg border border-negative/20 mr-2">
              <span className="text-[13px] text-negative font-medium flex items-center gap-1.5">
                <AlertCircle size={15} /> You are disconnected.
              </span>
              <button
                onClick={connectQuickbooks}
                className="text-[12px] bg-negative hover:bg-negative-dark text-white px-3 py-1.5 rounded-md flex items-center gap-1.5 transition-colors font-semibold shadow-sm"
              >
                <Zap size={13} fill="currentColor" /> Connect to QuickBooks
              </button>
            </div>
          )}

          <button className="flex items-center justify-center w-10 h-10 bg-bg-card hover:bg-bg-page border border-border rounded-md text-text-muted transition-all group">
            <Bell size={18} className="group-hover:text-primary" />
          </button>
          
          <div className="relative group">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-2 px-4 h-10 bg-primary hover:bg-primary-dark text-white text-[14px] font-semibold rounded-md transition-all active:scale-[0.98] min-w-[150px] justify-between"
            >
              <div className="flex items-center gap-2">
                <Building2 size={16} />
                <span>{selectedCompany}</span>
              </div>
              <ChevronDown size={14} className={cn("transition-transform duration-200", isDropdownOpen && "rotate-180")} />
            </button>

            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setIsDropdownOpen(false)}
                />
                <div className="absolute right-0 mt-2 w-56 bg-bg-card border border-border rounded-lg shadow-xl z-20 py-1 overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right">
                  <div className="px-3 py-2 text-[11px] font-bold text-text-muted uppercase tracking-wider">
                    Switch Company
                  </div>
                  <button
                    onClick={() => {
                      setSelectedCompany("Sample Company");
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors text-left",
                      selectedCompany === "Sample Company" ? "bg-primary/10 text-primary font-semibold" : "text-text-secondary hover:bg-bg-page"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", selectedCompany === "Sample Company" ? "bg-primary" : "bg-transparent")} />
                    Sample Company
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCompany("Sage Healthy");
                      setIsDropdownOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-2.5 text-[14px] transition-colors text-left",
                      selectedCompany === "Sage Healthy" ? "bg-primary/10 text-primary font-semibold" : "text-text-secondary hover:bg-bg-page"
                    )}
                  >
                    <div className={cn("w-2 h-2 rounded-full", selectedCompany === "Sage Healthy" ? "bg-primary" : "bg-transparent")} />
                    Sage Healthy
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
