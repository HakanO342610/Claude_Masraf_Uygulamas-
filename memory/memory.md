# 📋 Project Memory — Expense Management App

> **Son Güncelleme:** 2026-02-27 23:44 (Oturum #3)
> **Proje:** Claude_Proj1 — Kurumsal Masraf Yönetimi & SAP Entegrasyon Platformu

---

## ⚠️ HER OTURUM BAŞINDA YAPILMASI GEREKENLER

> [!IMPORTANT]
> **Bu dosyayı her yeni oturum açıldığında mutlaka oku ve analiz et!**
> Nerede kaldığını, hangi fazda olduğunu ve sonraki adımların ne olduğunu buradan hatırla.

1. **`memory/memory.md`** → Bu dosyayı oku — proje durumunu, tamamlanan özellikleri ve aktif fazı öğren
2. **`memory/Expense_Management_SAP_REST_Architecture.md`** → Ana mimari/ürün vizyonu dokümanı — proje kapsamını ve hedefleri hatırla
3. **`Hooks/PROJE_KURALLARI.md`** → Git hook kuralları, güvenlik ve commit süreçlerini hatırla
4. **Fazları takip et** → Aşağıdaki faz planını kontrol et, sıradaki faza göre çalışmayı sürdür
5. **Major değişikliklerde memory.md güncelle** ve git'e commit/push yap

**Referans Dosyalar:**

- Ana Mimari: `/Users/holusan/24_02_26_Claude_Code/Claude_Proj1/memory/Expense_Management_SAP_REST_Architecture.md`
- Proje Kuralları: `/Users/holusan/24_02_26_Claude_Code/Claude_Proj1/Hooks/PROJE_KURALLARI.md`
- SAP Entegrasyon: `/Users/holusan/24_02_26_Claude_Code/Claude_Proj1/memory/SAP_Entegration.md`
- Memory: `/Users/holusan/24_02_26_Claude_Code/Claude_Proj1/memory/memory.md`

---

## 🎯 PROJE FAZ PLANI

### FAZ 1 — Temel Altyapı & Scaffolding ✅ TAMAMLANDI

- [x] Proje scaffolding (NestJS + React + Flutter)
- [x] Docker Compose (postgres, backend, web)
- [x] Prisma schema tasarımı ve migration
- [x] Git Hooks (pre-commit, pre-push)
- [x] K8s konfigürasyonları
- [x] Health check endpoint
- [x] Swagger API docs

### FAZ 2 — Authentication & Yetkilendirme ✅ TAMAMLANDI

- [x] JWT authentication (access + refresh token)
- [x] Role-based authorization (ADMIN, MANAGER, FINANCE, EMPLOYEE)
- [x] Login / Register ekranları (Web + Mobile)
- [x] Email doğrulama sistemi (Nodemailer + Gmail SMTP)
- [x] Admin onay mekanizması (Register → Email Confirm → Admin Approve → Login)
- [x] User Management CRUD (list, approve, edit, delete, role, manager assign)

### FAZ 3 — Masraf Yönetimi (Core) ✅ TAMAMLANDI

- [x] Expense CRUD (create, read, update, delete)
- [x] Expense workflow (Draft → Submit → Approve/Reject)
- [x] Dashboard (özet kartlar, son masraflar, toplam tutar)
- [x] Dashboard auto-refresh (tab dönüşlerinde)
- [x] Expense list (filtreleme, durum bazlı)
- [x] Expense form (yeni masraf girişi, düzenleme)
- [x] Multi-currency desteği (TRY, EUR, USD, GBP)

### FAZ 4 — Fiş/Makbuz & OCR ✅ TAMAMLANDI

- [x] Receipt upload (galeri + kamera)
- [x] Receipt listeleme ve expense'e bağlama
- [x] Gemini Vision API (gemini-1.5-flash) OCR + Tesseract fallback — 2026-02-28
- [x] vendor, date, amount, currency, category otomatik çıkarımı

### FAZ 5 — Onay Workflow ✅ TAMAMLANDI

- [x] Approval modülü (pending approvals listesi)
- [x] Manager/Admin onay ve red işlemleri
- [x] Approval geçmişi görüntüleme
- [x] Web + Mobile approval ekranları

### FAZ 6 — Raporlama & Analitik ✅ TAMAMLANDI

- [x] Summary raporu
- [x] Departman bazlı rapor
- [x] Kategori bazlı rapor
- [x] Aylık rapor
- [x] CSV export
- [x] Reports ekranı (Web + Mobile)

### FAZ 7 — SAP Entegrasyon 🟡 BAĞLANTI BEKLİYOR

- [x] SAP Integration modülü (backend altyapısı)
- [x] SAP posting endpoint
- [x] Queue mekanizması (retry, dead-letter)
- [x] Master data sync endpoint
- [x] Multi-adapter mimarisi: ECC / S4_ONPREM / S4_CLOUD — SAP_TYPE env ile seçilir — 2026-02-28
  - SapEccAdapter → Z_EXP_POST_SRV, Basic Auth, flat payload
  - SapS4OnPremAdapter → API_JOURNALENTRY_POST, Basic Auth
  - SapS4CloudAdapter → API_JOURNALENTRY_POST, OAuth 2.0
- [x] GET /integration/sap/test-connection endpoint eklendi
- [x] SAP_COMPANY_CODE=1481, SAP_TYPE=ECC, SAP_EXPENSE_PATH env vars eklendi
- [ ] .env'ye gerçek SAP IP ve credentials girilerek test-connection çalıştırılacak
- [ ] Z_EXP_POST_SRV field mapping doğrulanacak (SAP BASIS ile)
- [ ] End-to-end posting testi

### FAZ 8 — İleri Özellikler ✅ TAMAMLANDI

- [x] Push notification (Firebase) → PushService (firebase-admin), PATCH /users/me/fcm-token, approve/reject bildirim — 2026-02-28
  - Mobile: firebase_messaging + flutter_local_notifications, PushNotificationService, main.dart init
  - **NOT:** Firebase proje kurulumu + google-services.json / GoogleService-Info.plist gerekli (env: FIREBASE_SERVICE_ACCOUNT)
- [x] Offline mode → Hive offline cache (connectivity_plus, LocalStorageService, offline banner) eklendi — 2026-02-28
- [x] Expense policy engine → PolicyRule (Prisma model), PolicyModule/Service/Controller, submit'de otomatik kontrol — 2026-02-28
  - Kategori bazlı aylık limit, fiş zorunluluğu kuralları
- [x] Escalation kuralları → notifications.service.ts cron (her saat), 48h timeout → üst manager onay talebi — 2026-02-27
- [x] Dark mode → Web: Tailwind darkMode:'class' + useThemeStore (localStorage) + Sun/Moon toggle header'da — 2026-02-28
  - Mobile: ThemeProvider (SharedPreferences) + toggle butonu dashboard AppBar'da
- [x] Çoklu dil desteği (i18n — TR/EN) → Web: i18n.ts (60+ key) + useI18nStore + Languages toggle header'da — 2026-02-28
  - Mobile: flutter_localizations + l10n.yaml + app_tr.arb + app_en.arb, varsayılan: TR
- [x] Audit log ekranı (admin) → GET /users/admin/audit-logs (sayfalı, filtreli) + Web: /dashboard/admin/audit-logs — 2026-02-28

### FAZ 9 — Test & Kalite ✅ TAMAMLANDI (2026-02-28)

- [x] Unit testler (backend services) — 5 suite, 44 test ✅
  - auth.service.spec.ts (MailService mock eklendi) — 8 test
  - expenses.service.spec.ts (PushService, PolicyService, expense.findFirst mock) — 13 test
  - users.service.spec.ts — findAll, findById, updateFcmToken, approveUser, updateRole, findAuditLogs — 7 test
  - policy.service.spec.ts — checkExpense (pass/fail senaryolar) — 6 test
  - reports.service.spec.ts — 10 test
- [x] E2E testler (Web) — Playwright kurulumu + auth.spec.ts + expenses.spec.ts (`apps/web/e2e/`)
  - `npm run test:e2e` (web dizininde) — login flow, dashboard, expense CRUD (API mocked)
- [x] Flutter widget testleri — `test/models/expense_test.dart` (18 test) + `test/widgets/expense_card_test.dart` (14 test)
  - Model: fromJson, statusLabel, computed props, toJson, categories/currencies
  - Widget: ExpenseCard — description, amount, status badges, KDV, tags, onTap, date format
- [x] Security audit — kritik bulgular düzeltildi:
  - `GET /receipts/expense/:expenseId` → authorization eklendi (owner/elevated role)
  - `filePath` server path response'dan çıkarıldı (select ile filtrelendi)
  - JWT_SECRET startup validation → tanımsızsa `process.exit(1)`

### FAZ 10 — Production & Deployment 🟡 KISMEN YAPILDI

- [ ] Production environment setup
- [ ] SSL / HTTPS konfigürasyonu
- [x] CI/CD pipeline → Docker Hub push + K8s deploy job — 2026-02-28 (Secrets: DOCKER_HUB_USERNAME, DOCKER_HUB_TOKEN, KUBE_CONFIG_DATA)
- [x] K8s deployment → k8s/backend.yml + web.yml image placeholder güncellendi
- [ ] App Store / Google Play yayınlama → flutter_launcher_icons + flutter_native_splash config hazır, PNG assetler placeholder
- [ ] Monitoring & alerting setup

---

## 🏗️ Proje Genel Durumu

| Alan                       | Durum                   | Not                             |
| -------------------------- | ----------------------- | ------------------------------- |
| Backend API (NestJS)       | ✅ Çalışıyor            | Port 3001, Swagger /api/docs    |
| Web App (React)            | ✅ Çalışıyor            | Docker üzerinden                |
| Mobile App (Flutter)       | ✅ Çalışıyor            | iOS Simulator (iPhone 17 Pro)   |
| Database (PostgreSQL)      | ✅ Çalışıyor            | Docker üzerinden                |
| SAP Entegrasyon            | 🟡 Hazır (Bağlantı Yok) | REST/OData altyapısı kurulu     |
| Email Servisi (Gmail SMTP) | ✅ Çalışıyor            | Nodemailer + Gmail App Password |
| Docker Compose             | ✅ Çalışıyor            | postgres + backend + web        |
| K8s Config                 | ✅ Mevcut               | k8s/ dizininde yaml dosyaları   |

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
│   │       ├── screens/         # 9 ekran
│   │       ├── services/        # ApiService, AuthService
│   │       ├── models/          # User, Expense
│   │       └── config/          # API config
│   └── web/                     # React Web App
├── packages/                    # Paylaşılan paketler
├── Hooks/                       # Git pre-commit & pre-push hooks
├── k8s/                         # Kubernetes deployment configs
├── docker-compose.yml
├── memory/                                      # TÜM PROJE DOKÜMANLARI
│   ├── memory.md                                # ← BU DOSYA (Proje Hafızası)
│   ├── Expense_Management_SAP_REST_Architecture.md  # Ana Mimari Dokümanı
│   └── SAP_Entegration.md                       # SAP Entegrasyon Detayları
├── Hooks/PROJE_KURALLARI.md                     # GIT KURALLARI
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

## ✅ Tamamlanan Özellikler (Oturum Bazlı)

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

### Oturum #4 (2026-02-28)

- [x] **Web: Edit Expense Sayfası** — `apps/web/src/app/dashboard/expenses/[id]/page.tsx` oluşturuldu. DRAFT → düzenlenebilir form, diğer statuslar → read-only. Liste sayfasına DRAFT satırlar için Edit linki eklendi.
- [x] **CI/CD: Docker Push + K8s Deploy** — `.github/workflows/ci.yml` güncellendi: Docker Hub push + kubectl deploy job. `k8s/backend.yml` ve `web.yml` image placeholder güncellendi.
- [x] **Mobile: Hive Offline Cache** — `pubspec.yaml`'a hive + connectivity_plus eklendi. `ExpenseModel` (HiveObject), `LocalStorageService`, offline fallback `getExpenses()`, turuncu offline banner oluşturuldu.
- [x] **Mobile: Icons/Splash Config** — `flutter_launcher_icons.yaml` ve `flutter_native_splash.yaml` oluşturuldu (#1E3A8A). Placeholder PNG assetler `assets/icon/` ve `assets/splash/` altında.

### Oturum #3 (2026-02-27 — akşam)

- [x] **User Management Sistemi** — Admin CRUD (list, approve, edit, delete, role, manager)
- [x] **Email Doğrulama Sistemi** — Nodemailer + Gmail SMTP, HTML confirm page
- [x] **Kayıt Akışı** — Register → Email Confirm → Admin Approve → Login
- [x] **Dashboard Yenileme** — Sekmeler arası navigasyonda auto-refresh
- [x] **Scroll Düzeltmeleri** — Tüm ekranlara scroll physics eklendi
- [x] **User Silme** — Cascade delete (tüm ilişkili kayıtlar temizlenir)
- [x] **memory.md oluşturuldu** ve git push yapıldı

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

1. **Prisma IDE Lint Hataları** — `isApproved`, `isEmailConfirmed` alanları TypeScript tip hatası gösterebilir. Runtime'da sorun yok, `npm run build` başarılı.
2. **SAP Bağlantısı** — SAP_BASE_URL, SAP_USERNAME, SAP_PASSWORD henüz boş.
3. **iOS Simülatör Scroll** — Users ekranında SingleChildScrollView+BouncingScrollPhysics uygulandı.
4. **Kamera (Receipt)** — iOS simülatörde kamera sınırlı, galeri üzerinden test yapılmalı.

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
