"use client";

import { useState } from "react";
import { X, User, Mail, Phone, MapPin, FileEdit } from "lucide-react";
import { cn } from "@/lib/utils";

interface AddClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (customer: any) => void;
}

export default function AddClientModal({ isOpen, onClose, onAdd }: AddClientModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = "Client name is required";
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onAdd(formData);
    setFormData({ name: "", email: "", phone: "", address: "", notes: "" });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="h-full w-full max-w-[480px] bg-bg-card shadow-2xl animate-in slide-in-from-right duration-500 overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 z-10 bg-bg-card border-b border-border px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-[18px] font-semibold text-text-primary mb-0.5">Add New Client</h2>
            <p className="text-[13px] text-text-muted">Create a new customer profile</p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-text-muted hover:text-text-primary hover:bg-bg-page rounded-md transition-all cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section: Basic Info */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-1">
                <User size={16} className="text-primary" />
                <span className="text-[14px] font-semibold text-text-primary">Primary Identity</span>
             </div>
             
             <div className="space-y-1.5">
                <label className="text-[14px] font-medium text-text-primary">Full Name / Company Name *</label>
                <input 
                  type="text"
                  placeholder="e.g. Acme Corp or Jane Doe"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  className={cn(
                    "input-base",
                    errors.name ? "border-negative" : ""
                  )}
                />
                {errors.name && <p className="text-[12px] text-negative">{errors.name}</p>}
             </div>

             <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-text-primary">Email Address</label>
                  <div className="relative">
                    <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      className="input-base pl-9 h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[14px] font-medium text-text-primary">Phone Number</label>
                  <div className="relative">
                    <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                    <input 
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                      className="input-base pl-9 h-10"
                    />
                  </div>
                </div>
             </div>
          </div>

          {/* Section: Details */}
          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-1">
                <MapPin size={16} className="text-text-secondary" />
                <span className="text-[14px] font-semibold text-text-primary">Billing Address</span>
             </div>
             <textarea 
               placeholder="Street, City, State, ZIP..."
               rows={3}
               value={formData.address}
               onChange={(e) => setFormData({...formData, address: e.target.value})}
               className="input-base h-auto py-3 resize-none"
             />
          </div>

          <div className="space-y-4">
             <div className="flex items-center gap-2 mb-1">
                <FileEdit size={16} className="text-text-secondary" />
                <span className="text-[14px] font-semibold text-text-primary">Internal Notes</span>
             </div>
             <textarea 
               placeholder="Special pricing, custom payment terms, etc..."
               rows={4}
               value={formData.notes}
               onChange={(e) => setFormData({...formData, notes: e.target.value})}
               className="input-base h-auto py-3 resize-none"
             />
          </div>

          {/* Footer Actions */}
          <div className="pt-6 border-t border-border flex items-center justify-end gap-3 sticky bottom-3 bg-bg-card pb-6 mt-auto">
             <button 
               type="button"
               onClick={onClose}
               className="btn-secondary border-none hover:bg-transparent"
             >
               Discard
             </button>
             <button 
               type="submit"
               className="btn-primary px-8"
             >
               Add Client
             </button>
          </div>
        </form>
      </div>
    </div>
  );
}
