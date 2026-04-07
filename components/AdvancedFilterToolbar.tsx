"use client";

import { useState } from "react";
import { Search, Filter, RotateCcw, ChevronDown, Calendar, Receipt, Users, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

interface FilterOption {
  value: string;
  label: string;
}

interface AdvancedFilterToolbarProps {
  onSearch: (term: string) => void;
  onFilterChange: (key: string, value: string) => void;
  onReset: () => void;
  statusOptions?: FilterOption[];
  dateOptions?: FilterOption[];
  customerOptions?: FilterOption[];
  placeholder?: string;
  showCustomerFilter?: boolean;
}

export default function AdvancedFilterToolbar({
  onSearch,
  onFilterChange,
  onReset,
  statusOptions = [],
  dateOptions = [],
  customerOptions = [],
  placeholder = "Search...",
  showCustomerFilter = false,
}: AdvancedFilterToolbarProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    onSearch(e.target.value);
  };

  const handleSelect = (key: string, value: string) => {
    setActiveFilters({ ...activeFilters, [key]: value });
    onFilterChange(key, value);
  };

  const resetAll = () => {
    setSearchTerm("");
    setActiveFilters({});
    onReset();
  };

  return (
    <div className="flex flex-wrap items-center gap-3 card-base p-4">
      {/* Search Input */}
      <div className="relative group flex-1 min-w-[280px]">
        <Search 
          size={16} 
          className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" 
        />
        <input 
          type="text"
          placeholder={placeholder}
          value={searchTerm}
          onChange={handleSearch}
          className="input-base pl-10 h-10"
        />
      </div>

      {/* Date Filter */}
      {dateOptions.length > 0 && (
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Calendar size={14} className="text-text-muted" />
          </div>
          <select 
            className="h-10 pl-9 pr-8 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer hover:border-primary/50 transition-all"
            onChange={(e) => handleSelect("date", e.target.value)}
            value={activeFilters.date || "all"}
          >
            <option value="all">All Dates</option>
            {dateOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      )}

      {/* Status Filter */}
      {statusOptions.length > 0 && (
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Filter size={14} className="text-text-muted" />
          </div>
          <select 
            className="h-10 pl-9 pr-8 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer hover:border-primary/50 transition-all"
            onChange={(e) => handleSelect("status", e.target.value)}
            value={activeFilters.status || "all"}
          >
            <option value="all">Any Status</option>
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      )}

      {/* Customer Filter */}
      {showCustomerFilter && (
        <div className="relative group">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <Users size={14} className="text-text-muted" />
          </div>
          <select 
            className="h-10 pl-9 pr-8 bg-bg-card border border-border-input rounded-md text-[14px] text-text-primary focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary appearance-none cursor-pointer hover:border-primary/50 transition-all"
            onChange={(e) => handleSelect("customer", e.target.value)}
            value={activeFilters.customer || "all"}
          >
            <option value="all">All Clients</option>
            {customerOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        </div>
      )}

      {/* Reset Button */}
      <button 
        onClick={resetAll}
        className="btn-secondary h-10 px-3"
        title="Reset all filters"
      >
        <RotateCcw size={14} />
        <span>Reset</span>
      </button>
    </div>
  );
}
