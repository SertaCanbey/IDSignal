<div align="center">
  <h1>📡 IDSignal</h1>
  <p><b>Local, Privacy-First & Fast Microsoft Entra Security Analyzer</b></p>
  <a href="https://idsignal.org">Live Demo</a>
</div>

<br>

## 🇬🇧 English

IDSignal is an open-source, zero-cloud dependency security analyzer designed for Microsoft Entra ID (formerly Azure AD). It allows security teams and system administrators to quickly identify identity-based threats without uploading any sensitive tenant data to third-party servers.

### ✨ Key Features
- **Zero Cloud Dependencies:** Everything runs locally on your machine or private server. Your tenant data never leaves your environment.
- **Password Spray Detection:** Automatically unmasks distributed password spray campaigns (Event 50126) and groups them by threat actor.
- **MFA Gap Analysis:** Pinpoints users relying on weak SMS MFA or lacking MFA entirely.
- **Explainable Priorities:** Calculates a risk score for each user based on active attacks and missing security controls, providing clear remediation steps.
- **Live Interactive Dashboard:** A fast, responsive UI to review threats and filter critical accounts instantly.

### 🚀 Quick Start (Docker)

The easiest way to run IDSignal is via Docker:

`ash
docker run -d --name idsignal -v idsignal_data:/app/data -p 4317:4317 ghcr.io/sertacanbey/idsignal:latest
`
Then open your browser and navigate to http://localhost:4317.

*(You can also use docker-compose up -d directly from the source code).*

---

## 🇹🇷 Türkçe

IDSignal, Microsoft Entra ID (eski adıyla Azure AD) için geliştirilmiş, açık kaynaklı ve bulut bağımsız bir güvenlik analiz aracıdır. Güvenlik ekiplerinin ve sistem yöneticilerinin, hassas verilerini üçüncü parti sunuculara yüklemeden kimlik tabanlı tehditleri tamamen yerel olarak tespit etmesini sağlar.

### ✨ Temel Yetenekler
- **Sıfır Bulut Bağımlılığı:** Tüm analizler bilgisayarınızda veya kapalı ağınızda gerçekleşir. Kurum verileriniz asla dışarı sızmaz.
- **Parola Deneme (Spray) Tespiti:** Dağıtık parola deneme saldırılarını (Event 50126) otomatik olarak yakalar ve saldırganlara göre gruplar.
- **MFA Boşluk Analizi:** Zayıf SMS doğrulamasına güvenen veya hiç MFA kullanmayan hesapları tespit eder.
- **Açıklanabilir Önceliklendirme:** Aktif saldırılar ve eksik güvenlik yapılandırmalarını baz alarak her kullanıcı için bir risk skoru hesaplar ve iyileştirme adımları sunar.
- **Canlı ve Hızlı Arayüz:** Tehditleri incelemek ve kritik hesapları filtrelemek için hızlı, modern bir kontrol paneli.

### 🚀 Hızlı Başlangıç (Docker)

IDSignal'ı çalıştırmanın en kolay yolu Docker kullanmaktır:

`ash
docker run -d --name idsignal -v idsignal_data:/app/data -p 4317:4317 ghcr.io/sertacanbey/idsignal:latest
`
Çalıştırdıktan sonra tarayıcınızdan http://localhost:4317 adresine giderek arayüze ulaşabilirsiniz.

*(Alternatif olarak projeyi indirip klasör içinde docker-compose up -d komutunu da kullanabilirsiniz).*

<br>

---
**License:** MIT
