export interface SapExpensePayload {
  id: string;
  expenseDate: Date;
  amount: number;
  taxAmount: number;
  currency: string;
  category: string;
  costCenter: string | null;
  projectCode: string | null;
  description: string | null;
  reference: string;
  user: {
    sapEmployeeId: string | null;
    name: string;
    department: string | null;
  };
}

export interface SapPostResult {
  sapDocumentNumber: string;
  status: 'Posted' | 'Simulated';
  rawResponse?: any;
}

export interface SapConnectionResult {
  connected: boolean;
  systemType: string;
  sapSystem?: string;
  error?: string;
}

export interface ISapAdapter {
  /**
   * Post an approved expense to SAP and return the document number.
   */
  postExpense(payload: SapExpensePayload): Promise<SapPostResult>;

  /**
   * Test connectivity to the SAP system.
   */
  testConnection(): Promise<SapConnectionResult>;
}
