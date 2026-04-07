"use client";

import { useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

interface AccountItem {
  name: string;
  value: number;
}

interface AccountSection {
  name: string;
  items?: AccountItem[];
  subsections?: AccountSection[];
  total?: number;
}

interface ReportTableProps {
  data: AccountSection[];
  reportTitle: string;
  valueLabel?: string;
  subtitle?: string;
}

function SectionRow({
  section,
  depth = 0,
}: {
  section: AccountSection;
  depth?: number;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const hasChildren =
    (section.subsections && section.subsections.length > 0) ||
    (section.items && section.items.length > 0);
  const isTopLevel = depth === 0;
  const isSummaryRow =
    !hasChildren &&
    section.total !== undefined &&
    !section.items?.length &&
    !section.subsections?.length;

  return (
    <>
      {/* Section Header */}
      <tr
        className={cn(
          "group cursor-pointer transition-colors duration-200 border-b border-border-light hover:bg-bg-page/50",
          isTopLevel && "border-t-2 border-border mt-4 first:mt-0"
        )}
        onClick={() => hasChildren && setIsOpen(!isOpen)}
      >
        <td
          className={cn(
            "py-2.5 pr-4",
            isTopLevel
              ? "text-[14px] font-semibold text-text-primary"
              : isSummaryRow
              ? "text-[14px] font-semibold text-text-primary"
              : "text-[13px] font-medium text-text-secondary"
          )}
          style={{ paddingLeft: `${depth * 20 + 20}px` }}
        >
          <div className="flex items-center gap-1.5">
            <div className="w-4 flex items-center justify-center">
              {hasChildren && (
                <span className="text-text-muted transition-colors group-hover:text-primary">
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </span>
              )}
            </div>
            {section.name}
          </div>
        </td>
        <td
          className={cn(
            "py-2.5 text-right pr-6 tabular-nums tabular-nums",
            (isTopLevel || isSummaryRow) ? "text-[14px] font-semibold" : "text-[13px] font-medium",
            section.total !== undefined && section.total < 0 ? "text-negative" : "text-text-primary"
          )}
        >
          {section.total !== undefined ? formatCurrency(section.total) : ""}
        </td>
      </tr>

      {/* Children */}
      {isOpen && hasChildren && (
        <>
          {/* Sub-sections */}
          {section.subsections?.map((sub, idx) => (
            <SectionRow key={idx} section={sub} depth={depth + 1} />
          ))}

          {/* Items */}
          {section.items?.map((item, idx) => (
            <tr key={idx} className="hover:bg-bg-page/30 transition-colors border-b border-border-light">
              <td
                className="py-2 text-[13px] text-text-secondary"
                style={{ paddingLeft: `${(depth + 1) * 20 + 36}px` }}
              >
                {item.name}
              </td>
              <td
                className={cn(
                  "py-2 text-right pr-6 text-[13px] font-medium tabular-nums",
                  item.value < 0 ? "text-negative" : "text-text-primary"
                )}
              >
                {formatCurrency(item.value)}
              </td>
            </tr>
          ))}

          {/* Section Total */}
          {section.total !== undefined && hasChildren && (
            <tr className="bg-bg-page/10 border-b border-border-light">
              <td
                className="py-2.5 text-[13px] font-semibold text-text-primary italic"
                style={{ paddingLeft: `${depth * 20 + 20}px` }}
              >
                <div className="flex ml-5.5">Total {section.name}</div>
              </td>
              <td
                className={cn(
                  "py-2.5 text-right pr-6 text-[14px] font-bold tabular-nums border-t border-border-light",
                  section.total < 0 ? "text-negative" : "text-text-primary"
                )}
              >
                {formatCurrency(section.total)}
              </td>
            </tr>
          )}
        </>
      )}
    </>
  );
}

export default function ReportTable({
  data,
  reportTitle,
  valueLabel = "Amount",
  subtitle = "Jan 1 – Mar 25, 2026",
}: ReportTableProps) {
  return (
    <div
      className="bg-bg-card rounded-xl border border-border overflow-hidden"
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Table Header */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-[16px] font-semibold text-text-primary">
            {reportTitle}
          </h3>
          <span className="text-[13px] font-medium text-text-muted">
            {subtitle}
          </span>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-bg-page/40">
              <th className="text-left text-[14px] font-medium text-text-muted py-2.5 px-6">
                Account Classification
              </th>
              <th className="text-right text-[14px] font-medium text-text-muted py-2.5 pr-6">
                {valueLabel} (USD)
              </th>
            </tr>
          </thead>
        </table>
      </div>

      {/* Table Body */}
      <div className="overflow-auto max-h-[calc(100vh-320px)]">
        <table className="w-full">
          <tbody>
            {data.map((section, idx) => (
              <SectionRow key={idx} section={section} depth={0} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
