// app.js — Main application logic
import { auth, db } from "./firebase-init.js";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, getDoc, setDoc, updateDoc, increment,
  collection, getDocs, query, orderBy, limit
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ─── CONFIG ──────────────────────────────────────────────────────────────────
// Replace with your actual Gemini API key (or load from Firestore settings)
let GEMINI_API_KEY = "AQ.Ab8RN6LMd56ZVymtl8OLK3RRwfqY30DIH8eG0qdtkUVEvbz3jw";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent";
const ADMIN_EMAIL  = "bydesign@admin.com";

// ─── SYSTEM PROMPTS ──────────────────────────────────────────────────────────
const PROMPTS = {
  todo: (input) => `
Sen, Türk iş dünyasına özel bir verimlilik asistanısın.
Aşağıdaki görevleri alıp, saat 08:00'den başlayan, 09:00-19:00 arasına sığan,
GERÇEKÇI bir günlük zaman çizelgesi haline getir.

KURALLAR:
- Her görev için mantıklı süre tahmin et (toplantı: 60-90dk, e-posta: 15-30dk, vs.)
- Molalar ekle (öğle: 12:30-13:15, kahve molaları)
- Markdown formatında yaz, emoji kullan
- Başlık: ## 🗓️ Günlük Planın
- Zaman dilimlerini kalın yaz: **09:00 – 10:30**
- Sonuna "💡 İpucu" ekle

GÖREVLER:
${input}
`,

  notes: (input) => `
Sen, profesyonel bir iş danışmanısın. Aşağıdaki karmaşık notları al ve
ŞU FORMATTA düzenle (Türkçe, Markdown):

## 📋 Özet
(2-3 cümlelik net özet)

## 🔑 Anahtar Çıkarımlar
(madde madde, en önemli 5-7 nokta)

## ✅ Aksiyon Maddeleri
(yapılması gerekenler, öncelik sırasıyla, her biri için tahmini süre)

## 🗓️ Önerilen Zaman Çizelgesi
(acil / bu hafta / bu ay şeklinde)

Dil: Türkçe, sade iş dili, gereksiz cümle yok.

NOTLAR:
${input}
`,

  calendar: (input) => `
Sen, Türkiye pazarına hakim bir sosyal medya stratejistisin.
Aşağıdaki sektör/marka için 1 haftalık (Pazartesi-Pazar) sosyal medya içerik takvimi oluştur.

ÇIKTI FORMATI (Markdown tablosu):
| Gün | Platform | İçerik Türü | Başlık / Konu | En İyi Paylaşım Saati | Hashtag Önerisi |
|-----|----------|-------------|---------------|-----------------------|-----------------|
... (7 satır, farklı günler)

ARDINDA:
## 📌 Strateji Notları
(3-4 madde, bu sektöre özel taktik öneri)

## 🎯 Hedef Kitle
(2-3 cümle)

Platform seçimi (Instagram, TikTok, LinkedIn, X, YouTube Shorts) sektöre göre değişsin.
Türkiye'deki platformları ve trendleri göz önünde bulundur.
Dil: Türkçe.

SEKTÖR / MARKA:
${input}
`
};

// ─── TOAST ───────────────────────────────────────────────────────────────────
function showToast(msg, type = "success") {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

// ─── AUTH STATE ──────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (user) {
    document.getElementById("auth-overlay").classList.add("hidden");
    document.getElementById("app").classList.remove("hidden");
    await initUser(user);
    await loadGeminiKey();
  } else {
    document.getElementById("auth-overlay").classList.remove("hidden");
    document.getElementById("app").classList.add("hidden");
  }
});

async function initUser(user) {
  // Avatar & name
  const initials = (user.displayName || user.email || "U").slice(0,2).toUpperCase();
  const avatarEl  = document.getElementById("user-avatar");
  const nameEl    = document.getElementById("user-name-display");
  if (avatarEl) avatarEl.textContent = initials;
  if (nameEl)   { nameEl.textContent = user.displayName || user.email.split("@")[0]; nameEl.classList.remove("hidden"); }

  // Admin nav
  if (user.email === ADMIN_EMAIL) {
    const adminLink = document.getElementById("admin-nav-link");
    if (adminLink) { adminLink.href = "admin.html"; adminLink.classList.remove("hidden"); }
  }

  // Ensure Firestore doc exists
  const userRef = doc(db, "users", user.uid);
  const snap    = await getDoc(userRef);
  if (!snap.exists()) {
    await setDoc(userRef, {
      email: user.email,
      name:  user.displayName || "",
      plan:  "free",
      usageCount: 0,
      usageLimit: 5,
      createdAt: new Date().toISOString()
    });
  }

  // Update plan badge
  const data = snap.exists() ? snap.data() : { plan: "free", usageCount: 0, usageLimit: 5 };
  updatePlanBadge(data);
}

function updatePlanBadge(data) {
  const badge = document.getElementById("plan-badge");
  if (!badge) return;
  const icons = { free: "⚡", starter: "🚀", pro: "💎" };
  const names = { free: "Ücretsiz Plan", starter: "Starter Plan", pro: "Pro Plan" };
  const icon  = document.getElementById("plan-icon");
  const name  = document.getElementById("plan-name-display");
  const usage = document.getElementById("plan-usage-display");
  if (icon)  icon.textContent  = icons[data.plan] || "⚡";
  if (name)  name.textContent  = names[data.plan] || "Ücretsiz Plan";
  if (usage) usage.textContent = `${data.usageCount || 0} / ${data.usageLimit || 5} kullanım`;
}

async function loadGeminiKey() {
  try {
    const snap = await getDoc(doc(db, "settings", "gemini"));
    if (snap.exists() && snap.data().apiKey) {
      GEMINI_API_KEY = snap.data().apiKey;
    }
  } catch(e) { /* settings not yet set */ }
}

// ─── AUTH FUNCTIONS ───────────────────────────────────────────────────────────
window.switchAuthTab = function(tab) {
  document.getElementById("form-login").classList.toggle("hidden", tab !== "login");
  document.getElementById("form-register").classList.toggle("hidden", tab !== "register");
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-register").classList.toggle("active", tab === "register");
};

window.loginWithEmail = async function() {
  const email = document.getElementById("login-email").value.trim();
  const pass  = document.getElementById("login-password").value;
  const errEl = document.getElementById("auth-error");
  try {
    errEl.classList.add("hidden");
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.classList.remove("hidden");
  }
};

window.registerWithEmail = async function() {
  const name  = document.getElementById("reg-name").value.trim();
  const email = document.getElementById("reg-email").value.trim();
  const pass  = document.getElementById("reg-password").value;
  const errEl = document.getElementById("reg-error");
  try {
    errEl.classList.add("hidden");
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    if (name) await updateProfile(cred.user, { displayName: name });
    showToast("Hesabın oluşturuldu! Hoşgeldin 🎉");
  } catch(e) {
    errEl.textContent = friendlyAuthError(e.code);
    errEl.classList.remove("hidden");
  }
};

window.loginWithGoogle = async function() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch(e) {
    showToast(friendlyAuthError(e.code), "error");
  }
};

window.logout = async function() {
  await signOut(auth);
  window.location.href = "index.html";
};

function friendlyAuthError(code) {
  const map = {
    "auth/invalid-email":          "Geçersiz e-posta adresi.",
    "auth/user-not-found":         "Bu e-posta ile kayıtlı hesap bulunamadı.",
    "auth/wrong-password":         "Şifre hatalı.",
    "auth/email-already-in-use":   "Bu e-posta zaten kullanımda.",
    "auth/weak-password":          "Şifre en az 6 karakter olmalı.",
    "auth/popup-closed-by-user":   "Google girişi iptal edildi.",
    "auth/too-many-requests":      "Çok fazla deneme. Lütfen bekleyin.",
    "auth/invalid-credential":     "E-posta veya şifre hatalı.",
  };
  return map[code] || "Bir hata oluştu. Lütfen tekrar deneyin.";
}

// ─── TOOL RUNNER ─────────────────────────────────────────────────────────────
window.runTool = async function(tool) {
  const inputEl   = document.getElementById(`${tool}-input`);
  const resultEl  = document.getElementById(`${tool}-result`);
  const loadingEl = document.getElementById(`${tool}-loading`);
  const input     = inputEl.value.trim();

  if (!input) { showToast("Lütfen bir şeyler yaz!", "error"); return; }

  // Check usage limit
  const user    = auth.currentUser;
  if (!user) { showToast("Giriş yapman gerekiyor.", "error"); return; }
  const userRef = doc(db, "users", user.uid);
  const snap    = await getDoc(userRef);
  const data    = snap.data() || { usageCount: 0, usageLimit: 5 };

  if (data.usageCount >= data.usageLimit) {
    showToast("Aylık kullanım limitine ulaştın. Plan yükselt →", "error");
    window.location.href = "pricing.html";
    return;
  }

  // Show loading
  resultEl.classList.add("hidden");
  loadingEl.classList.remove("hidden");
  loadingEl.innerHTML = `<div class="loading-spinner"></div><span>AI düşünüyor<span class="loading-dots"></span></span>`;

  try {
    const prompt   = PROMPTS[tool](input);
    const response = await callGemini(prompt);

    // Hide loading, show result
    loadingEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = marked.parse(response);

    // Increment usage
    await updateDoc(userRef, { usageCount: increment(1) });
    const newCount = (data.usageCount || 0) + 1;
    const usageEl  = document.getElementById("plan-usage-display");
    if (usageEl) usageEl.textContent = `${newCount} / ${data.usageLimit || 5} kullanım`;

    // Log usage to Firestore
    try {
      await setDoc(doc(collection(db, "usage_logs")), {
        uid:    user.uid,
        email:  user.email,
        tool,
        ts:     new Date().toISOString()
      });
    } catch(e) { /* non-critical */ }

  } catch(err) {
    loadingEl.classList.add("hidden");
    resultEl.classList.remove("hidden");
    resultEl.innerHTML = `<p class="text-red-500">⚠️ Hata: ${err.message}</p><p class="text-stone-500 text-xs mt-1">Gemini API anahtarınızı kontrol edin.</p>`;
  }
};

// ─── GEMINI API ───────────────────────────────────────────────────────────────
async function callGemini(prompt) {
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "YOUR_GEMINI_API_KEY_HERE") {
    throw new Error("Gemini API anahtarı ayarlanmamış. Admin panelinden ekleyin.");
  }

  const res = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 2048,
        topP: 0.95
      }
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `API Hatası: ${res.status}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "Yanıt alınamadı.";
}
