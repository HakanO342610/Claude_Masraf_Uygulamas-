export interface IIdentityEmployee {
  externalId: string;          // Kaynak sistemdeki benzersiz ID (PERNR, ObjectId, uid, ...)
  name: string;
  email: string;
  department?: string;
  jobTitle?: string;
  managerExternalId?: string;  // Yöneticinin externalId'si (Azure AD, LDAP)
  managerEmail?: string;       // Yöneticinin e-postası (SAP HCM — MANAGEREMAIL alanı)
  sapEmployeeId?: string;      // SAP FI posting için personel numarası (SAP HCM'de = externalId)
  isActive: boolean;
}

export interface IIdentityAdapter {
  /** Kaynak sistemdeki tüm aktif çalışanları döner */
  syncUsers(): Promise<IIdentityEmployee[]>;
  /** Bağlantı testi */
  testConnection(): Promise<{ connected: boolean; systemInfo?: string; error?: string }>;
}
