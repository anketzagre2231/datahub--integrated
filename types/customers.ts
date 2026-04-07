export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  balance: number;
  status: "active" | "inactive" | "overdue";
  lastUpdated: string;
  createdDate: string;
}

export const customersData: Customer[] = [];
