# 📋 Project Memory — Expense Management App

> **Son Güncelleme:** 2026-02-27 23:30 (Oturum #3)
> **Proje:** Claude_Proj1 — Kurumsal Masraf Yönetimi & SAP Entegrasyon Platformu

---

## 🏗️ Proje Genel Durumu

| Alan                       | Durum                   | Not                                                           |
| -------------------------- | ----------------------- | ------------------------------------------------------------- |
| Backend API (NestJS)       | ✅ Çalışıyor            | Port 3001, Swagger /api/docs                                  |
| Web App (React)            | ✅ Çalışıyor            | Docker üzerinden                                              |
| Mobile App (Flutter)       | ✅ Çalışıyor            | iOS Simulator (iPhone 17 Pro)                                 |
| Database (PostgreSQL)      | ✅ Çalışıyor            | Docker üzerinden                                              |
| SAP Entegrasyon            | 🟡 Hazır (Bağlantı Yok) | REST/OData altyapısı kurulu, gerçek SAP bağlantısı bekleniyor |
| Email Servisi (Gmail SMTP) | ✅ Çalışıyor            | Nodemailer + Gmail App Password ayarlı                        |
| Docker Compose             | ✅ Çalışıyor            | postgres + backend + web                                      |
| K8s Config                 | ✅ Mevcut               | k8s/ dizininde yaml dosyaları                                 |

---

## 📁 Proje Yapısı

```
Claude_Proj1/
├── apps/
│   ├── backend/          # NestJS Backend (Node.js)
│   │   ├── src/
│   │   │   ├── auth/            # Login, Register, Email Confirm, JWT
│   │   │   ├── users/           # User CRUD, Role, Approve, Delete
│   │   │   ├── expenses/        # Expense CRUD, Submit, Approve, Reject
│   │   │   ├── approvals/       # Approval workflow
│   │   │   ├── receipts/        # Receipt upload, OCR
│   │   │   ├── reports/         # Summary, by-dept, by-category, monthly, CSV
│   │   │   ├── mail/            # MailService (Nodemailer Gmail SMTP)
│   │   │   ├── sap-integration/ # SAP REST posting, queue, master-data
│   │   │   ├── notifications/   # Cron-based notifications
│   │   │   ├── health/          # Health check endpoint
│   │   │   ├── common/          # Guards, Decorators
│   │   │   └── prisma/          # PrismaService
│   │   └── prisma/schema.prisma # DB şeması
│   ├── mobile/expense_mobile/   # Flutter iOS App
│   │   └── lib/
│   │       ├── screens/         # 9 ekran (dashboard, expenses, receipts,
│   │       │                    #   reports, approvals, users, login,
│   │       │                    #   register, expense_form)
│   │       ├── services/        # ApiService, AuthService
│   │       ├── models/          # User, Expense
│   │       └── config/          # API config
│   └── web/                     # React Web App
├── packages/                    # Paylaşılan paketler
├── Hooks/                       # Git pre-commit & pre-push hooks
├── k8s/                         # Kubernetes deployment configs
├── docker-compose.yml
├── Expense_Management_SAP_REST_Architecture.md
├── SAP_Entegration.md
└── memory.md                    # ← Bu dosya
```

---

## 🔑 Veritabanı Modeli (Prisma)

**Ana Tablolar:** User, Expense, Approval, Receipt, AuditLog, RefreshToken, SapPostingQueue

**User Model Alanları:**

- id, sapEmployeeId, name, email, password, department, role, managerId
- `isApproved` (Boolean) — Admin onayı
- `isEmailConfirmed` (Boolean) — Email doğrulaması
- `confirmationToken` (String) — Email doğrulama tokeni

**Roller:** ADMIN, MANAGER, FINANCE, EMPLOYEE

---

## ✅ Tamamlanan Özellikler

### Oturum #1 (2026-02-26)

- [x] Proje scaffolding (NestJS backend + React web + Flutter mobile)
- [x] Docker Compose (postgres, backend, web)
- [x] Prisma schema tasarımı ve migration
- [x] JWT authentication (access + refresh token)
- [x] Role-based authorization (Guards + Decorators)
- [x] Expense CRUD (create, read, update, delete)
- [x] Expense workflow (draft → submit → approve/reject)
- [x] Receipt upload ve OCR altyapısı
- [x] Reports modülü (summary, by-department, by-category, monthly, CSV export)
- [x] SAP Integration modülü (posting, queue, retry, master-data)
- [x] Notifications servisi (cron-based)
- [x] Health check endpoint
- [x] Swagger API docs (/api/docs)
- [x] Git Hooks (pre-commit: büyük dosya/şifre kontrolü, pre-push: build testi)

### Oturum #2 (2026-02-27 — gündüz)

- [x] Approval workflow fix (MANAGER/ADMIN roller approve/reject yapabiliyor)
- [x] Web + Mobile approval butonları çalışır hale getirildi
- [x] Receipt upload hatası düzeltildi (JPEG dosyalar)

### Oturum #3 (2026-02-27 — akşam)

- [x] **User Management Sistemi** — Admin rolü ile tam kullanıcı yönetimi
  - [x] Backend: User CRUD (findAll, findById, updateRole, assignManager, approve, updateUser, deleteUser)
  - [x] Backend: Cascade delete (expenses, receipts, approvals, auditLogs, refreshTokens, managerRef temizleme)
  - [x] Mobile: Users sekmesi (ADMIN rolü için bottom bar'da)
  - [x] Mobile: Kullanıcı listesi, onaylama, rol değiştirme, manager atama, düzenleme, silme
- [x] **Email Doğrulama Sistemi**
  - [x] Nodemailer + Gmail SMTP kurulumu (holusan@gmail.com)
  - [x] Kayıt sırasında gerçek doğrulama emaili gönderimi
  - [x] `/auth/confirm-email/:token` endpoint — profesyonel HTML sayfası (başarı/hata)
  - [x] Login kontrolü: isEmailConfirmed + isApproved zorunlu
- [x] **Kayıt Akışı** — Register → Email Doğrula → Admin Onayı → Login
  - [x] RegisterDto: department alanı opsiyonel yapıldı
  - [x] Register sonrası auto-login kaldırıldı, bilgilendirme mesajı gösteriliyor
- [x] **Dashboard Yenileme** — Sekmeler arası navigasyonda veri otomatik yenileniyor
- [x] **Scroll Düzeltmeleri** — Tüm ekranlara AlwaysScrollableScrollPhysics eklendi

---

## ⚙️ Ortam Değişkenleri (.env)

```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/expense_management
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRATION=24h
PORT=3001
CORS_ORIGINS=http://localhost:3000
MAIL_USER=holusan@gmail.com
MAIL_PASS=<Gmail App Password>
APP_BASE_URL=http://localhost:3001
```

---

## 🧪 Test Hesapları

| Email                | Rol      | Şifre            |
| -------------------- | -------- | ---------------- |
| admin@company.com    | ADMIN    | (seed'den gelen) |
| manager@company.com  | MANAGER  | (seed'den gelen) |
| finance@company.com  | FINANCE  | (seed'den gelen) |
| employee@company.com | EMPLOYEE | (seed'den gelen) |

---

## 🐛 Bilinen Sorunlar / Dikkat Edilecekler

1. **Prisma IDE Lint Hataları** — `isApproved`, `isEmailConfirmed` alanları için IDE bazen TypeScript tip hatası gösterir. Ancak `prisma generate` çalıştırılmıştır ve runtime'da sorun yoktur. `npm run build` başarılı geçer.
2. **SAP Bağlantısı** — SAP_BASE_URL, SAP_USERNAME, SAP_PASSWORD henüz boş. Gerçek SAP ortamı bağlandığında test edilmeli.
3. **iOS Simülatör Scroll** — Users ekranında SingleChildScrollView+BouncingScrollPhysics uygulandı.
4. **Kamera (Receipt)** — iOS simülatörde kamera desteği sınırlıdır, galeri üzerinden test yapılmalı.

---

## 🚀 Gelecek Adımlar (Backlog)

- [ ] Push notification sistemi (Firebase)
- [ ] Offline mode (SQLite cache)
- [ ] Multi-currency desteği (kur çevirme)
- [ ] Expense policy engine (limit kuralları)
- [ ] OCR iyileştirme (Gemini Vision API)
- [ ] SAP gerçek bağlantı testi
- [ ] Production deployment (K8s)
- [ ] App Store / Google Play yayınlama
- [ ] Dark mode tema desteği
- [ ] Çoklu dil desteği (i18n)

---

## 📌 Önemli Komutlar

```bash
# Backend başlatma
cd apps/backend && npm run start:dev

# Docker ile tüm servisleri başlatma
docker compose up -d

# Prisma işlemleri
cd apps/backend && npx prisma generate && npx prisma db push

# Flutter mobil uygulama
cd apps/mobile/expense_mobile && flutter run -d "iPhone 17 Pro"

# Git hooks aktifleştirme
chmod +x Hooks/pre-commit Hooks/pre-push
git config core.hooksPath Hooks
```
