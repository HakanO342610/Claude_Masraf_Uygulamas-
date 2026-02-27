import { UserRole, ExpenseStatus, ApprovalStatus } from './enums';

export interface UserBase {
  id: string;
  name: string;
  email: string;
  department?: string;
  role: UserRole;
  sapEmployeeId?: string;
  managerId?: string;
}

export interface ExpenseBase {
  id: string;
  userId: string;
  expenseDate: string;
  amount: number;
  currency: string;
  taxAmount?: number;
  category: string;
  projectCode?: string;
  costCenter?: string;
  description?: string;
  status: ExpenseStatus;
  sapDocumentNumber?: string;
  receiptUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalBase {
  id: string;
  expenseId: string;
  approverId: string;
  status: ApprovalStatus;
  comment?: string;
  actionDate?: string;
  createdAt: string;
}

export interface ReceiptBase {
  id: string;
  expenseId?: string;
  fileName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
  ocrStatus: string;
  ocrData?: Record<string, unknown>;
  uploadedBy: string;
  createdAt: string;
}

export interface CreateExpensePayload {
  expenseDate: string;
  amount: number;
  currency?: string;
  taxAmount?: number;
  category: string;
  projectCode?: string;
  costCenter?: string;
  description?: string;
}

export interface UpdateExpensePayload {
  amount?: number;
  category?: string;
  description?: string;
  costCenter?: string;
  projectCode?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  department?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ReportSummary {
  totalExpenses: number;
  totalAmount: number;
  averageAmount: number;
  maxAmount: number;
  byCategory: { category: string; count: number; totalAmount: number }[];
  byStatus: { status: string; count: number }[];
}

export interface CategoryReport {
  category: string;
  count: number;
  totalAmount: number;
  percentage: number;
}

export interface DepartmentReport {
  department: string;
  count: number;
  totalAmount: number;
}

export interface MonthlyReport {
  month: number;
  monthName: string;
  count: number;
  totalAmount: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}
