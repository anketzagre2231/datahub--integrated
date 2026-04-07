"use client";

import { useState, useEffect } from "react";
import { X, User, Mail, Phone, MapPin, FileEdit, CheckCircle2, Zap, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: any) => Promise<void>;
  initialData: any;
  title: string;
  fields: {
    name: string;
    label: string;
    type: "text" | "email" | "tel" | "textarea" | "select";
    placeholder?: string;
    icon?: any;
    options?: { label: string; value: string }[];
    disabled?: boolean;
  }[];
  mode?: "edit" | "view";
  variant?: "modal" | "drawer";
  onSecondaryAction?: () => void;
  secondaryActionLabel?: string;
}

export default function GenericEditModal({
  isOpen,
  onClose,
  onSave,
  initialData,
  title,
  fields,
  mode = "edit",
  variant = "drawer",
  onSecondaryAction,
  secondaryActionLabel,
}: EditModalProps) {
  const [formData, setFormData] = useState<any>(initialData || {});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await onSave(formData);
      setSuccess(true);
      setTimeout(() => {
        onClose();
        setSuccess(false);
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Failed to update record");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "fixed inset-0 z-50 flex bg-black/40 backdrop-blur-sm animate-in fade-in duration-300",
      variant === "modal" ? "items-center justify-center p-4" : "items-center justify-end"
    )}>
      <div className={cn(
        "bg-bg-card shadow-2xl animate-in duration-500",
        variant === "modal" 
          ? "w-full max-w-2xl max-h-[90vh] rounded-2xl zoom-in-95 flex flex-col overflow-hidden" 
          : "h-full w-full max-w-[480px] slide-in-from-right overflow-y-auto"
      )}>
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-card border-b border-border px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-0.5">{title}</h2>
            <p className="text-[13px] text-text-muted">
              {mode === "view" ? "View record information" : "Update record information"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-page rounded-md transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className={cn("p-6 space-y-6", variant === "modal" && "overflow-y-auto flex-1")}>
          {success ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in zoom-in duration-300">
              <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                <CheckCircle2 size={32} />
              </div>
              <p className="text-[16px] font-semibold text-text-primary">Update Successful!</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="p-3 bg-negative/10 border border-negative/20 rounded-md text-[13px] text-negative font-medium">
                  {error}
                </div>
              )}

              {fields.map((field) => (
                <div key={field.name} className="space-y-1.5">
                  <label className="text-[12px] font-semibold text-text-muted uppercase tracking-wider">{field.label}</label>
                  <div className="relative">
                    {mode === "view" ? (
                      <div className="flex items-center gap-3 p-3 bg-bg-page/40 rounded-lg border border-border/50 text-text-primary">
                        {field.icon && <field.icon size={16} className="text-text-muted shrink-0" />}
                        <span className="text-[14px] font-medium">
                          {field.type === "select" 
                            ? field.options?.find(o => o.value === formData[field.name])?.label || formData[field.name] || "—"
                            : formData[field.name] || "—"}
                        </span>
                      </div>
                    ) : (
                      <>
                        {field.icon && (
                          <field.icon
                            size={14}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                          />
                        )}

                        {field.type === "textarea" ? (
                          <textarea
                            value={formData[field.name] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                            placeholder={field.placeholder}
                            rows={4}
                            className="input-base h-auto py-3 resize-none"
                          />
                        ) : field.type === "select" ? (
                          <select
                            value={formData[field.name] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                            disabled={field.disabled}
                            className={cn("input-base pl-9 h-10 appearance-none bg-bg-card", field.disabled && "opacity-60 bg-bg-page cursor-not-allowed text-text-muted")}
                          >
                            {field.options?.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={field.type}
                            value={formData[field.name] || ""}
                            onChange={(e) => setFormData({ ...formData, [field.name]: e.target.value })}
                            placeholder={field.placeholder}
                            disabled={field.disabled}
                            className={cn("input-base h-10", field.icon ? "pl-9" : "px-3", field.disabled && "opacity-60 bg-bg-page cursor-not-allowed text-text-muted")}
                          />
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}

              {/* Footer Actions */}
              <div className="pt-6 border-t border-border flex items-center justify-end gap-3 sticky bottom-3 bg-bg-card pb-6 mt-auto">
                {mode === "view" ? (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-secondary flex-1"
                    >
                      Close
                    </button>
                    {onSecondaryAction && (
                      <button
                        type="button"
                        onClick={onSecondaryAction}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                        style={{ backgroundColor: "var(--color-primary-dark)" }}
                      >
                        <Zap size={14} fill="currentColor" />
                        {secondaryActionLabel || "Action"}
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={onClose}
                      className="btn-secondary border-none hover:bg-transparent"
                    >
                      Cancel
                    </button>
                    <button type="submit" disabled={loading} className="btn-primary px-8 flex items-center gap-2">
                      {loading ? "Saving..." : "Save Changes"}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
}
