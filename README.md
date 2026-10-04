<div align="center">
  <img src="public/brand-logo.png" alt="IDSignal Logo" width="300" />
  <h1>IDSignal</h1>
  <p><b>Local, Privacy-First & Fast Microsoft Entra Security Analyzer</b></p>
  <a href="https://idsignal.org">Live Demo & Official Website</a> • <a href="https://www.linkedin.com/in/sertac-canbey/" target="_blank">LinkedIn</a>
</div>

<br>

## 🇬🇧 English

**IDSignal** is an open-source, zero-cloud dependency security analyzer designed for Microsoft Entra ID (formerly Azure AD). It enables security teams and system administrators to quickly identify identity-based threats without ever uploading sensitive tenant data to third-party servers. 

### ✨ Key Features
- **Zero Cloud Dependencies:** Everything runs locally on your machine or inside your private network. Your tenant data never leaves your environment.
- **Password Spray Detection:** Automatically unmasks distributed password spray campaigns (Event 50126) and groups them by threat actor IPs.
- **MFA Gap Analysis:** Pinpoints users relying on weak SMS MFA or lacking MFA entirely.
- **Explainable Priorities:** Calculates a risk score for each user based on active attacks and missing security controls, providing clear remediation steps.
- **Live Interactive Dashboard:** A fast, modern UI to review threats and filter critical accounts instantly.

### 🔑 Microsoft 365 Requirements
To initially connect IDSignal to your Microsoft 365 tenant, the user performing the setup needs **Global Administrator** or **Privileged Role Administrator** rights. This is only required once to create the App Registration and grant the following **read-only** API permissions:
- `User.Read.All` (To map users and their status)
- `UserAuthenticationMethod.Read.All` (To check MFA configurations)
- `ActivityFeed.Read` (To ingest sign-in and audit logs)

### 📋 Prerequisites & Tools
Depending on how you choose to run IDSignal, you will need the corresponding tools. 

**For Docker users:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

**For Local Native users (Windows):**
You can quickly install both Node.js (v24+) and Azure CLI via PowerShell `winget`:
```powershell
winget install OpenJS.NodeJS.LTS
winget install Microsoft.AzureCLI
```
*(Azure CLI is only required if you want to use the 1-click Guided Auto-Setup via the UI).*

### 🚀 Quick Start (Docker)
The easiest way to run IDSignal is via Docker. Open your terminal and run:
```bash
docker run -d --name idsignal -v idsignal_data:/app/data -p 4317:4317 ghcr.io/sertacanbey/idsignal:latest
```
Navigate to `http://localhost:4317` in your browser. *(Note: Docker users should use the "Manual Setup" fallback option in the UI to connect to Microsoft 365, as the guided automation requires a Windows desktop environment).*

### 💻 Local Native Install (Node.js)
If you prefer running it natively on Windows (which enables the 1-click Guided Setup via Azure CLI):
```bash
git clone https://github.com/SertaCanbey/IDSignal.git
cd IDSignal
npm install --omit=dev
npm start
```
Navigate to `http://localhost:4317` and follow the on-screen guided setup.

---

## 🇹🇷 Türkçe

**IDSignal**, Microsoft Entra ID (eski adıyla Azure AD) için geliştirilmiş, açık kaynaklı ve tamamen bulut bağımsız bir güvenlik analiz aracıdır. Güvenlik ekiplerinin, kurumlarına ait hassas verileri üçüncü parti sunuculara sızdırmadan kimlik tabanlı tehditleri kendi yerel ağlarında (lokal) tespit etmesini sağlar.

### ✨ Temel Yetenekler
- **Sıfır Bulut Bağımlılığı:** Tüm analizler bilgisayarınızda veya kapalı ağınızda gerçekleşir. Kurum verileriniz asla dışarıya gönderilmez.
- **Parola Deneme (Spray) Tespiti:** Dağıtık parola deneme saldırılarını (Event 50126) otomatik olarak yakalar ve saldırgan IP'lerine göre kümelendirir.
- **MFA Boşluk Analizi:** Zayıf SMS doğrulamasına güvenen veya hiç MFA kullanmayan hesapları tespit eder.
- **Açıklanabilir Önceliklendirme:** Aktif saldırılar ve eksik güvenlik yapılandırmalarını baz alarak her kullanıcı için bir risk skoru hesaplar ve çözüm adımları sunar.
- **Canlı ve Hızlı Arayüz:** Tehditleri incelemek ve hesapları filtrelemek için hızlı, modern bir kontrol paneli.

### 🔑 Microsoft 365 Gereksinimleri
IDSignal'ı Microsoft 365 sisteminize (Tenant) ilk kez bağlarken, kurulumu yapan kullanıcının **Global Administrator (Genel Yönetici)** veya **Privileged Role Administrator** yetkisine sahip olması gerekir. Bu yetki yalnızca bir kereye mahsus, uygulamanın (App Registration) arka planda şu **salt-okunur (read-only)** izinleri alabilmesi için kullanılır:
- `User.Read.All` (Kullanıcı dizinini çekmek için)
- `UserAuthenticationMethod.Read.All` (MFA durumlarını görmek için)
- `ActivityFeed.Read` (Giriş loglarını yakalamak için)

### 📋 Gerekli Programlar (Prerequisites)
Kullanım tercihinize göre şunlardan biri kurulu olmalıdır:

**Docker kullanıcıları için:**
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

**Lokal Kurulum Tercih Edenler (Windows) İçin:**
Sisteminize Node.js ve Azure CLI kurmanın en hızlı yolu, PowerShell üzerinden şu iki kodu girmektir:
```powershell
winget install OpenJS.NodeJS.LTS
winget install Microsoft.AzureCLI
```
*(Azure CLI kurulumu sadece arayüzdeki "Otomatik Sihirbazı" kullanarak API izni vermek istiyorsanız zorunludur).*

### 🚀 Hızlı Başlangıç (Docker)
Kurulumun en pratik yolu Docker kullanmaktır:
```bash
docker run -d --name idsignal -v idsignal_data:/app/data -p 4317:4317 ghcr.io/sertacanbey/idsignal:latest
```
Ardından tarayıcınızdan `http://localhost:4317` adresine gidin. *(Not: Docker tamamen arka planda ekransız çalıştığı için, pencereli otomatik kurulum sihirbazını desteklemez. Arayüzdeki "Manuel Kurulum" seçeneğini kullanarak Microsoft 365'i bağlamanız gerekir).*

### 💻 Lokal Kurulum (Node.js)
Azure CLI destekli "Tek Tıkla Otomatik Kurulum" sihirbazını kullanmak ve projeyi doğrudan bilgisayarınızda çalıştırmak isterseniz:
```bash
git clone https://github.com/SertaCanbey/IDSignal.git
cd IDSignal
npm install --omit=dev
npm start
```
Ardından tarayıcınızdan `http://localhost:4317` adresine gidip ekrandaki kurulum adımlarını izleyebilirsiniz.

<br>

---
**License:** MIT
