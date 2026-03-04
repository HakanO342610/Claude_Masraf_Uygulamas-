export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  MANAGER = 'MANAGER',
  FINANCE = 'FINANCE',
  ADMIN = 'ADMIN',
}

export enum ExpenseStatus {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  MANAGER_APPROVED = 'MANAGER_APPROVED',
  FINANCE_APPROVED = 'FINANCE_APPROVED',
  REJECTED = 'REJECTED',
  POSTED_TO_SAP = 'POSTED_TO_SAP',
}

export enum ApprovalStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

export enum OcrStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum SapQueueStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  DEAD_LETTER = 'DEAD_LETTER',
}

// ─── Kurulum Modeli (Organization.setupModel) ─────────────────────────
export enum SetupModel {
  STANDALONE = 'STANDALONE',       // Model A: Kullanıcılar ürün içinden manuel yönetilir
  SAP_HR = 'SAP_HR',              // Model B: SAP HR sisteminden otomatik senkronize
  DIRECTORY = 'DIRECTORY',         // Model C: LDAP/AD/External DB'den senkronize
}

// ─── SAP Sistem Tipi (Model B alt seçimi) ────────────────────────────
export enum SapSystemType {
  ECC_HCM = 'ECC_HCM',            // SAP ECC + HR/HCM modülü (SICF REST)
  S4_ONPREM = 'S4_ONPREM',        // S4 HANA On-Premise (OData API)
  S4_CLOUD = 'S4_CLOUD',          // S4 HANA Cloud / Rise — SuccessFactors (OData API)
}

// ─── Directory Tipi (Model C alt seçimi) ──────────────────────────────
export enum DirectoryType {
  LDAP = 'LDAP',                   // On-prem Active Directory / OpenLDAP
  AZURE_AD = 'AZURE_AD',          // Azure AD / Entra ID (Microsoft Graph)
  EXTERNAL_DB = 'EXTERNAL_DB',    // Harici veritabanı / REST API
}
