"use client";

import { ChevronLeft, ChevronRight, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  className?: string;
}

export default function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  className,
}: PaginationProps) {
  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  // Simple logic to show current, first, last and 1 around current
  const visiblePages = pages.filter(
    (page) =>
      page === 1 ||
      page === totalPages ||
      (page >= currentPage - 1 && page <= currentPage + 1)
  );

  return (
    <div className={cn("flex items-center justify-between py-3", className)}>
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage === 1}
          className="relative inline-flex items-center px-4 py-2 text-[14px] font-medium text-text-secondary bg-bg-card border border-border-input rounded-md hover:bg-bg-page disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage === totalPages}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-[14px] font-medium text-text-secondary bg-bg-card border border-border-input rounded-md hover:bg-bg-page disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-[14px] text-text-muted">
            Showing page <span className="font-semibold text-text-primary">{currentPage}</span> of{" "}
            <span className="font-semibold text-text-primary">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md -space-x-px bg-bg-card" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-border-input text-text-muted hover:bg-bg-page disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            
            {visiblePages.map((page, index) => {
              const showEllipsis = index > 0 && page - visiblePages[index - 1] > 1;
              return (
                <div key={page} className="flex">
                  {showEllipsis && (
                    <span className="relative inline-flex items-center px-3 py-2 border border-border-input text-text-muted bg-bg-card">
                      <MoreHorizontal className="h-4 w-4" />
                    </span>
                  )}
                  <button
                    onClick={() => onPageChange(page)}
                    aria-current={currentPage === page ? "page" : undefined}
                    className={cn(
                      "relative inline-flex items-center px-4 py-2 border text-[14px] transition-all duration-200",
                      currentPage === page
                        ? "z-10 bg-primary/10 border-primary text-primary-dark font-semibold"
                        : "border-border-input text-text-secondary hover:bg-bg-page font-medium"
                    )}
                  >
                    {page}
                  </button>
                </div>
              );
            })}

            <button
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-border-input text-text-muted hover:bg-bg-page disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
