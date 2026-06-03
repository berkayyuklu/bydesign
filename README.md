# bydesign.ai — AI Laboratuvarı

Minimalist, açık tema SaaS arayüzü. Gemini API + Firebase + İyzico entegrasyonu.

---

## 📁 Dosya Yapısı

```
bydesign/
├── index.html          # Ana sayfa (araçlar + auth)
├── pricing.html        # Fiyatlandırma sayfası
├── admin.html          # Admin paneli
├── style.css           # Global stiller
├── firebase-init.js    # Firebase başlatma modülü
├── app.js              # Ana uygulama mantığı (araçlar + auth)
├── pricing.js          # Fiyatlandırma + ödeme mantığı
├── admin.js            # Admin panel mantığı
├── firestore.rules     # Firebase güvenlik kuralları
└── README.md
```

---

## 🚀 Kurulum Adımları

### 1. Gemini API Anahtarı Al
1. [Google AI Studio](https://aistudio.google.com/) → "Get API Key"
2. Yeni bir API anahtarı oluştur
3. Admin paneli → Ayarlar → Gemini API kısmına yapıştır
   (ya da `app.js` içindeki `GEMINI_API_KEY` değişkenini doğrudan güncelle)

### 2. Firebase Kurulumu
1. [Firebase Console](https://console.firebase.google.com/) → `bydesign-bc4a2` projesine git
2. **Authentication** → Sign-in method → E-posta/Şifre + Google'ı etkinleştir
3. **Authorized domains** → `bydesign.com.tr` ekle
4. **Firestore Database** → Oluştur (production mode)
5. **Firestore → Rules** sekmesine git → `firestore.rules` içeriğini yapıştır → Yayınla

### 3. Admin Hesabı Oluştur
1. Siteyi aç → "Kayıt Ol" → `bydesign@admin.com` / `admin2008` ile kayıt ol
2. Artık nav'da "Admin Panel" linki görünür

### 4. İyzico Entegrasyonu
1. [iyzico.com](https://www.iyzico.com/) → Sandbox hesabı aç
2. Dashboard → API Anahtarları → Sandbox Key + Secret Key kopyala
3. Admin Panel → Ayarlar → İyzico kısmına yapıştır
4. **Prodüksiyon için**: Kart bilgilerini sunucu tarafında işle!
   `functions/` klasörü oluşturup Firebase Functions kullan.

### 5. GitHub'a Yükle
```bash
git init
git add .
git commit -m "Initial commit: bydesign.ai AI Lab"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADI/bydesign-ai.git
git push -u origin main
```

### 6. Firebase Hosting'e Deploy (Opsiyonel)
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# Public directory: . (mevcut klasör)
# Single-page app: No
firebase deploy
```

---

## ⚙️ Özellikler

### 3 AI Aracı
| Araç | Açıklama | Gemini Prompt |
|------|----------|---------------|
| Akıllı Ajanda | Görevleri saatlik plana çevirir | Türkçe, emoji destekli |
| AI Not Düzenleyici | Özet + Çıkarımlar + Aksiyon | Yapılandırılmış Markdown |
| İçerik Takvimi | 7 günlük sosyal medya planı | Tablo + strateji notları |

### Auth
- E-posta/şifre girişi
- Google ile giriş
- Yeni kayıt
- Oturum yönetimi (Firebase Auth)

### Admin Paneli (`/admin.html`)
- Dashboard: kullanıcı sayısı, gelir, kullanım istatistikleri
- Kullanıcı yönetimi: plan değiştirme, kullanım sıfırlama
- Plan/fiyat CRUD: yeni plan ekle, düzenle, sil
- Ödeme geçmişi tablosu
- Ayarlar: Gemini API key, İyzico key, site başlığı

### Ödeme
- İyzico altyapısı (sandbox test modu hazır)
- Prodüksiyon için Firebase Functions gerekli

---

## 🔑 Önemli Notlar

### Güvenlik
- Gemini API anahtarı frontend'de yer alır → Prodüksiyon için Firebase Functions + API proxy kullan
- İyzico'da kart bilgileri **ASLA** frontend'den direkt API'ye gönderilmemeli → sunucu tarafı şart
- Firestore rules dosyası tüm güvenlik kurallarını içeriyor

### Kullanım Limitleri (Firestore'dan yönetilir)
- Ücretsiz: 5 kullanım/ay
- Starter: 50 kullanım/ay
- Pro: Sınırsız (999)

---

## 📞 Destek
bydesign@admin.com
