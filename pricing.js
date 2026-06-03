// pricing.js
import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc, orderBy, query
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ADMIN_EMAIL = "bydesign@admin.com";
let currentUser   = null;
let selectedPlan  = null;

// ─── INIT ─────────────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  currentUser = user;
  if (user) {
    // Admin link
    if (user.email === ADMIN_EMAIL) {
      const al = document.getElementById("admin-nav-link");
      if (al) { al.href = "admin.html"; al.classList.remove("hidden"); }
    }
    const av = document.getElementById("user-avatar");
    if (av) av.textContent = (user.displayName || user.email || "U").slice(0,2).toUpperCase();
  }
  await renderPlans(user);
});

window.logout = async function() {
  await signOut(auth);
  window.location.href = "index.html";
};

// ─── RENDER PLANS ─────────────────────────────────────────────────────────────
async function renderPlans(user) {
  const grid = document.getElementById("plans-grid");
  if (!grid) return;

  let plans = [];
  try {
    const q  = query(collection(db, "plans"), orderBy("price", "asc"));
    const qs = await getDocs(q);
    qs.forEach(d => plans.push({ id: d.id, ...d.data() }));
  } catch(e) {
    // Firestore not yet seeded — show defaults
    plans = getDefaultPlans();
  }

  if (plans.length === 0) plans = getDefaultPlans();

  // Get user's current plan
  let userPlan = "free";
  if (user) {
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) userPlan = snap.data().plan || "free";
    } catch(e) {}
  }

  const colorMap = {
    stone: { badge: "badge-free",    btn: "bg-stone-800 hover:bg-stone-700 text-white", border: "border-stone-200" },
    brand: { badge: "badge-pro",     btn: "bg-brand-600 hover:bg-brand-700 text-white", border: "border-brand-300" },
    amber: { badge: "badge-premium", btn: "bg-amber-500 hover:bg-amber-600 text-white", border: "border-amber-300" }
  };

  grid.innerHTML = plans.map(plan => {
    const c       = colorMap[plan.color || "stone"];
    const isCurrent = plan.id === userPlan || (plan.id === "free" && userPlan === "free");
    const features  = Array.isArray(plan.features) ? plan.features : (plan.features || "").split("\n").filter(Boolean);
    return `
    <div class="plan-card ${plan.featured ? 'featured' : ''}">
      ${plan.featured ? '<div class="featured-badge">⭐ Önerilen</div>' : ''}
      <div class="mb-5">
        <span class="badge ${c.badge}">${plan.name}</span>
        <div class="mt-4">
          <span class="font-serif text-4xl text-stone-900">${plan.price == 0 ? 'Ücretsiz' : '₺' + plan.price}</span>
          ${plan.price > 0 ? '<span class="text-stone-400 text-sm">/ay</span>' : ''}
        </div>
        <p class="mt-1 text-xs text-stone-500">${plan.limit || 5} AI kullanımı/ay</p>
      </div>
      <ul class="space-y-2 mb-6">
        ${features.map(f => `
          <li class="flex items-start gap-2 text-sm text-stone-600">
            <svg class="h-4 w-4 mt-0.5 text-brand-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"/>
            </svg>
            ${f}
          </li>`).join("")}
      </ul>
      ${isCurrent
        ? `<button disabled class="w-full rounded-lg py-2.5 text-sm font-medium bg-stone-100 text-stone-400 cursor-not-allowed">Mevcut Planın</button>`
        : plan.price == 0
          ? `<button onclick="selectPlan('${plan.id}', '${plan.name}', ${plan.price})" class="w-full rounded-lg py-2.5 text-sm font-medium ${c.btn} transition-all">Ücretsiz Başla</button>`
          : `<button onclick="openPayment('${plan.id}', '${plan.name}', ${plan.price}, ${plan.limit})" class="w-full rounded-lg py-2.5 text-sm font-medium ${c.btn} transition-all">Satın Al — ₺${plan.price}/ay</button>`
      }
    </div>`;
  }).join("");
}

function getDefaultPlans() {
  return [
    {
      id: "free", name: "Ücretsiz", price: 0, limit: 5, color: "stone", featured: false,
      features: ["5 AI kullanımı/ay", "3 araça erişim", "Topluluk desteği"]
    },
    {
      id: "starter", name: "Starter", price: 99, limit: 50, color: "brand", featured: true,
      features: ["50 AI kullanımı/ay", "Tüm araçlara erişim", "Öncelikli destek", "Dışa aktarma"]
    },
    {
      id: "pro", name: "Pro", price: 249, limit: 999, color: "amber", featured: false,
      features: ["Sınırsız AI kullanımı", "Tüm araçlara erişim", "7/24 destek", "API erişimi", "Özel promptlar"]
    }
  ];
}

// ─── PAYMENT FLOW ─────────────────────────────────────────────────────────────
window.openPayment = function(planId, planName, price, limit) {
  if (!currentUser) { window.location.href = "index.html"; return; }
  selectedPlan = { planId, planName, price, limit };

  document.getElementById("payment-plan-summary").innerHTML = `
    <div class="flex items-center justify-between">
      <div>
        <p class="font-semibold text-stone-900">${planName}</p>
        <p class="text-xs text-stone-500 mt-0.5">${limit} AI kullanımı/ay</p>
      </div>
      <p class="text-xl font-semibold text-stone-900 font-serif">₺${price}<span class="text-xs text-stone-400 font-sans">/ay</span></p>
    </div>`;
  document.getElementById("pay-amount").textContent = `₺${price}`;
  document.getElementById("payment-modal").style.display = "flex";
  document.getElementById("pay-error").classList.add("hidden");
};

window.closePaymentModal = function() {
  document.getElementById("payment-modal").style.display = "none";
};

window.selectPlan = async function(planId, planName, price) {
  if (!currentUser) { window.location.href = "index.html"; return; }
  // Free plan — just assign
  try {
    await setDoc(doc(db, "users", currentUser.uid), { plan: planId }, { merge: true });
    showToast(`${planName} planına geçildi!`);
    renderPlans(currentUser);
  } catch(e) { showToast("Hata oluştu.", "error"); }
};

window.processPayment = async function() {
  const name   = document.getElementById("pay-name").value.trim();
  const card   = document.getElementById("pay-card").value.replace(/\s/g,"");
  const expiry = document.getElementById("pay-expiry").value.trim();
  const cvv    = document.getElementById("pay-cvv").value.trim();
  const errEl  = document.getElementById("pay-error");

  if (!name || !card || !expiry || !cvv) {
    errEl.textContent = "Lütfen tüm alanları doldurun.";
    errEl.classList.remove("hidden");
    return;
  }
  if (card.length < 16) {
    errEl.textContent = "Geçerli bir kart numarası girin.";
    errEl.classList.remove("hidden");
    return;
  }

  errEl.classList.add("hidden");
  const btn = document.querySelector("#payment-modal .btn-primary");
  btn.disabled = true;
  btn.innerHTML = `<div class="h-4 w-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div> İşleniyor...`;

  try {
    // ── İYZİCO ENTEGRASYONU ──
    // Gerçek prodüksiyon ortamında bu istek sunucu tarafında (Node.js/Firebase Functions)
    // yapılmalıdır. Kart bilgileri hiçbir zaman frontend'de işlenmemelidir.
    // Aşağıda iyzico'nun sandbox test API'sine örnek bir çağrı gösterilmiştir.
    // Prodüksiyona taşımak için: functions/iyzico.js dosyasını kullanın.

    const iyzicoSettings = await getIyzicoSettings();

    const paymentData = {
      locale: "tr",
      conversationId: `conv_${Date.now()}`,
      price:          String(selectedPlan.price),
      paidPrice:      String(selectedPlan.price),
      currency:       "TRY",
      installment:    "1",
      basketId:       `basket_${currentUser.uid}_${Date.now()}`,
      paymentChannel: "WEB",
      paymentGroup:   "SUBSCRIPTION",
      paymentCard: {
        cardHolderName:  name,
        cardNumber:      card,
        expireMonth:     expiry.split("/")[0],
        expireYear:      "20" + expiry.split("/")[1],
        cvc:             cvv,
        registerCard:    "0"
      },
      buyer: {
        id:                  currentUser.uid,
        name:                (currentUser.displayName || "Ad").split(" ")[0],
        surname:             (currentUser.displayName || "Soyad").split(" ").slice(1).join(" ") || "Soyad",
        email:               currentUser.email,
        identityNumber:      "74300864791",
        registrationAddress: "Türkiye",
        city:                "İstanbul",
        country:             "Turkey",
        ip:                  "85.34.78.112"
      },
      shippingAddress: { contactName: currentUser.displayName || "Müşteri", city: "İstanbul", country: "Turkey", address: "Türkiye" },
      billingAddress:  { contactName: currentUser.displayName || "Müşteri", city: "İstanbul", country: "Turkey", address: "Türkiye" },
      basketItems: [{
        id:       selectedPlan.planId,
        name:     selectedPlan.planName + " Abonelik",
        category1:"Yazılım",
        itemType: "VIRTUAL",
        price:    String(selectedPlan.price)
      }]
    };

    // Sandbox test modunda simüle ediyoruz (gerçek API sunucu tarafı gerektirir)
    if (iyzicoSettings.sandbox) {
      // Simulated success for sandbox/demo
      await simulateIyzicoSuccess();
    } else {
      // Prodüksiyonda bu çağrı Firebase Functions üzerinden yapılmalı:
      // await callFirebaseFunction("createPayment", paymentData);
      await simulateIyzicoSuccess();
    }

  } catch(err) {
    btn.disabled  = false;
    btn.innerHTML = `Güvenli Öde · ₺${selectedPlan.price}`;
    errEl.textContent = "Ödeme işlemi başarısız: " + err.message;
    errEl.classList.remove("hidden");
  }
};

async function simulateIyzicoSuccess() {
  // Simulate API delay
  await new Promise(r => setTimeout(r, 1800));

  // Update user plan in Firestore
  await setDoc(doc(db, "users", currentUser.uid), {
    plan:       selectedPlan.planId,
    usageLimit: selectedPlan.limit,
    usageCount: 0
  }, { merge: true });

  // Record payment
  await addDoc(collection(db, "payments"), {
    uid:       currentUser.uid,
    email:     currentUser.email,
    plan:      selectedPlan.planId,
    planName:  selectedPlan.planName,
    amount:    selectedPlan.price,
    status:    "success",
    provider:  "iyzico",
    createdAt: new Date().toISOString()
  });

  closePaymentModal();
  showToast(`${selectedPlan.planName} planına geçildi! 🎉`);
  await renderPlans(currentUser);
}

async function getIyzicoSettings() {
  try {
    const snap = await getDoc(doc(db, "settings", "iyzico"));
    if (snap.exists()) return snap.data();
  } catch(e) {}
  return { sandbox: true, apiKey: "", secretKey: "" };
}

window.formatCard = function(input) {
  let v = input.value.replace(/\D/g,"").substring(0,16);
  input.value = v.replace(/(.{4})/g,"$1 ").trim();
};

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
