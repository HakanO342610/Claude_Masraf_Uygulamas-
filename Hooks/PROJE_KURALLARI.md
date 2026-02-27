# 🛡️ Proje Uyumluluk, Güvenlik ve Geliştirme Kuralları

Bu belge proje dahilindeki dosya hiyerarşisi, GitHub (git) üzerinden çalışma yönetimi ve karşılaşılabilecek olası problemleri yönetme yöntemlerini içerir. Geliştirici takım üyelerinin commit ve pushlama adımlarından önce nelere dikkat etmesi gerektiğini anlatan bir rehberdir.

### 1. Dosya Sistemi ve İsimlendirme Kuralları (Compatibility Rules)

- **Küçük Harf ve Tire Kullanımı**: Node ve tarayıcı bileşenleri için genelde dosya isimlendirmelerde `kucuk-harf-ve-tire` (kebab-case) önerilir (Örn: `home-page.js`).
- **Maksimum Dosya Yükü:** Çözüm dosyalarının tek seferde 5 MB'ı aşmamasına özen gösterin (büyük dosyalar `pre-commit` hook ile takılır). Video/Resim dosyaları varlık depolarına (asset storage / aws s3 vb.) gönderilmelidir.
- **Geçici Dizinler**: `.git` deposuna kalıntılar atılmamalıdır (Örn: `node_modules`, `.angular`, `.next`, `dist`, `build`, `.env`). `.gitignore` içinde açıkça belirtilmelidir. Eklendiği anda `pre-push` hook itiraz eder.

### 2. GitHub Push ve Hook Süreçleri

Olası hatalı paylaşımları GitHub’a göndermeden engellemek için Git Hooks yapılandırılmıştır:

1.  **pre-commit Hook (`Hooks/pre-commit`)**: Siz projedeki dosyalarınızı lokal depoya işlerken (commit);
    - Boyutu 5MB'dan büyük devasa dosyaları eklemeye çalıştığınızı veya
    - İçerisinde `password`, `.env` içeren dosyaları fark eder ve sizi uyarır.

2.  **pre-push Hook (`Hooks/pre-push`)**: Geliştirmeyi tamamlayıp Github sunucusuna Push komutu verirseniz;
    - İcra sırasında hatalı `node_modules` klasörünün repoya sızıp sızmadığını test eder,
    - Projenin temel `package.json` yapısına göre **npm run build:all** adımlarını otomatik olarak dener. Şayet projeniz hata ile (crash ile) sonuçlanan bir aşamasındaysa bu aşama sizi bir hata ile durdurur; dolayısıyla "çalışmayan" bir yapıyı repository (ana repoya) yüklemekten kaçındırır.

### Olası Problemler ve Çözümleri:

- **Sorun:** `❌ Hata: Kodlarınız derleme (build) sırasında hata aldı.` (pre-push hatası)
  - **Çözüm:** GitHub’a yüklemeden önce lokal ortamda `npm run build:all` testlerinde patlayan yeri çözün, commit'i güncelleyin (`git commit --amend` veya yeni bir commit), ondan sonra `git push` deneyin.

- **Sorun:** `⚠️ Uyarı: Şifre veya gizli anahtar barındırabilecek dosyalar ekliyor` (pre-commit uyarısı)
  - **Çözüm:** Commit işleminden vazgeçip o .env türevi dosyayı derhal `.gitignore` içeriğine yerleştirin ve çalışma (working) dizininden `git rm --cached dosya.adi` şeklinde takip etmeyi bırakın.

### Kurallarınızı Kurmak/Etkinleştirmek (Kurulum)

Bu `Hooks` dizininden oluşturulan sistemlerin çalışabilmesi için her yeni geliştiricinin şu bash komutlarını terminale girmesi gereklidir:

```bash
# Scriptleri çalıştırılabilir yapın:
chmod +x Hooks/pre-commit Hooks/pre-push

# Git'in otomatik olarak bu hook'ları kullanmasını sağlayın:
git config core.hooksPath Hooks
```

Her projedeki güncellemeleri ve ne yaptığımızı detaylı senin hatırlaman için memory.md de tutuyoruz her çalıştığında nerde kaldığını buradan hatırla ve major düzenlemelerde bu dosyayı güncelle.

**(Not: En baştan projenize bu konfigürasyonu AI Agent uyguladı, bu nedenle sizde direkt devreye girdi.)**
