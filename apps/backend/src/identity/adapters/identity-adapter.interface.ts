// ─── Organizasyon Birimi (SAP: ORGEH, AD: OU) ─────────────────────────
export interface IOrgUnit {
  externalId: string;           // Kaynak sistemdeki org unit ID
  name: string;                 // Org unit adı
  code: string;                 // Kısa kod
  parentExternalId?: string;    // Üst org unit ID
  managerExternalId?: string;   // Birim yöneticisinin externalId'si
  managerEmail?: string;        // Birim yöneticisinin e-postası
  level?: number;               // Hiyerarşi seviyesi (0=root)
}

// ─── Pozisyon (SAP: PLANS, SF: Position) ──────────────────────────────
export interface IPosition {
  externalId: string;           // Kaynak sistemdeki pozisyon ID
  title: string;                // Pozisyon adı
  code: string;                 // Kısa kod
  orgUnitExternalId?: string;   // Bağlı olduğu org unit
  parentPositionExternalId?: string; // Üst pozisyon
  level?: number;               // Hiyerarşi seviyesi
}

// ─── Çalışan ──────────────────────────────────────────────────────────
export interface IIdentityEmployee {
  externalId: string;           // Kaynak sistemdeki benzersiz ID (PERNR, ObjectId, uid, ...)
  name: string;
  email: string;
  department?: string;          // Departman adı (düz metin, geriye uyumluluk)
  departmentCode?: string;      // Org unit kodu (Department FK için)
  jobTitle?: string;
  positionCode?: string;        // Pozisyon kodu (Position FK için)
  managerExternalId?: string;   // Yöneticinin externalId'si (Azure AD, LDAP)
  managerEmail?: string;        // Yöneticinin e-postası (SAP HCM — MANAGEREMAIL alanı)
  upperManagerExternalId?: string; // Üst yöneticinin externalId'si (skip-level)
  upperManagerEmail?: string;   // Üst yöneticinin e-postası
  sapEmployeeId?: string;       // SAP FI posting için personel numarası (SAP HCM'de = externalId)
  isActive: boolean;
}

// ─── Adapter Interface ────────────────────────────────────────────────
export interface IIdentityAdapter {
  /** Kaynak sistemdeki tüm aktif çalışanları döner */
  syncUsers(): Promise<IIdentityEmployee[]>;

  /** Organizasyon birimlerini döner (opsiyonel — SAP OM, SuccessFactors) */
  syncOrgUnits?(): Promise<IOrgUnit[]>;

  /** Pozisyonları döner (opsiyonel — SAP OM, SuccessFactors) */
  syncPositions?(): Promise<IPosition[]>;

  /** Bağlantı testi */
  testConnection(): Promise<{ connected: boolean; systemInfo?: string; error?: string }>;
}
