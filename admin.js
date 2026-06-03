// admin.js — Full admin panel logic
import { auth, db } from "./firebase-init.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  collection, getDocs, doc, getDoc, setDoc, addDoc,
  updateDoc, deleteDoc, query, orderBy, limit, where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const ADMIN_EMAIL = "bydesign@admin.com";
let allUsers = [];

// ─── AUTH GUARD ───────────────────────────────────────────────────────────────
onAuthStateChanged(auth, async (user) => {
  if (!user || user.email !== ADMIN_EMAIL) {
    // Not admin → redirect
    window.location.href = "index.html";
    return;
  }
  document.getElementById("admin-guard").classList.add("hidden");
  document.getElementById("admin-app").classList.remove("hidden");
  await loadDashboard();
});

window.logout = async function() {
  await signOut(auth);
  window.location.href = "index.html";
};

// ─── SECTION NAVIGATION ──────────────────────────────────────────────────────
window.showSection = function(name) {
  const sections = ["dashboard","users","plans","payments","settings"];
  sections.forEach(s => {
    document.getElementById(`section-${s}`).classList.toggle("hidden", s !== name);
  });
  document.querySelectorAll(".admin-nav-btn[data-section]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === name);
  });
  const titles = {
    dashboard: "Dashboard",
    users:     "Kullanıcılar",
    plans:     "Planlar & Fiyatlar",
    payments:  "Ödemeler",
    settings:  "Ayarlar"
  };
  document.getElementById("section-title").textContent = titles[name] || name;

  // Lazy load
  if (name === "users")    loadUsers();
  if (name === "plans")    loadPlansAdmin();
  if (name === "payments") loadPayments();
  if (name === "settings") loadSettings();
};

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    // Totals
    const [usersSnap, plansSnap, paymentsSnap, usageSnap] = await Promise.all([
      getDocs(collection(db, "users")),
      getDocs(query(collection(db, "plans"))),
      getDocs(collection(db, "payments")),
      getDocs(collection(db, "usage_logs"))
    ]);

    document.getElementById("stat-users").textContent   = usersSnap.size;
    document.getElementById("stat-plans").textContent   = plansSnap.size || 3;
    document.getElementById("stat-usage").textContent   = usageSnap.size;

    // Revenue this month
    const thisMonth = new Date().toISOString().slice(0,7);
    let revenue     = 0;
    paymentsSnap.forEach(d => {
      const p = d.data();
      if (p.createdAt?.startsWith(thisMonth) && p.status === "success") {
        revenue += p.amount || 0;
      }
    });
    document.getElementById("stat-revenue").textContent = `₺${revenue.toLocaleString("tr-TR")}`;

    // Recent users
    const recent = [];
    usersSnap.forEach(d => recent.push({ id: d.id, ...d.data() }));
    recent.sort((a,b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0,5);

    const listEl = document.getElementById("recent-users-list");
    if (recent.length === 0) {
      listEl.innerHTML = '<p class="text-stone-400">Henüz kullanıcı yok.</p>';
    } else {
      listEl.innerHTML = recent.slice(0,5).map(u => `
        <div class="flex items-center justify-between py-2 border-b border-stone-100 last:border-0">
          <div class="flex items-center gap-3">
            <div class="h-8 w-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-semibold">
              ${(u.name || u.email || "?").slice(0,2).toUpperCase()}
            </div>
            <div>
              <p class="font-medium text-stone-800">${u.name || "—"}</p>
              <p class="text-xs text-stone-400">${u.email}</p>
            </div>
          </div>
          <span class="badge ${planBadgeClass(u.plan)}">${u.plan || "free"}</span>
        </div>`).join("");
    }
  } catch(e) {
    console.error("Dashboard error:", e);
  }
}

// ─── USERS ────────────────────────────────────────────────────────────────────
async function loadUsers() {
  const tbody = document.getElementById("users-table-body");
  tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-stone-400">Yükleniyor...</td></tr>`;
  try {
    const snap = await getDocs(collection(db, "users"));
    allUsers   = [];
    snap.forEach(d => allUsers.push({ id: d.id, ...d.data() }));
    allUsers.sort((a,b) => (b.createdAt||"").localeCompare(a.createdAt||""));
    renderUsersTable(allUsers);
    document.getElementById("user-count").textContent = `${allUsers.length} kullanıcı`;
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-red-400">Hata: ${e.message}</td></tr>`;
  }
}

function renderUsersTable(users) {
  const tbody = document.getElementById("users-table-body");
  if (users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-stone-400">Kullanıcı bulunamadı.</td></tr>`;
    return;
  }
  tbody.innerHTML = users.map(u => `
    <tr class="hover:bg-stone-50 transition-colors">
      <td class="px-5 py-3">
        <div class="flex items-center gap-2.5">
          <div class="h-7 w-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 text-xs font-semibold flex-shrink-0">
            ${(u.name || u.email || "?").slice(0,2).toUpperCase()}
          </div>
          <div>
            <p class="font-medium text-stone-800 text-xs">${u.name || "—"}</p>
            <p class="text-xs text-stone-400">${u.email}</p>
          </div>
        </div>
      </td>
      <td class="px-5 py-3"><span class="badge ${planBadgeClass(u.plan)}">${u.plan || "free"}</span></td>
      <td class="px-5 py-3 text-xs text-stone-500">${u.usageCount||0} / ${u.usageLimit||5}</td>
      <td class="px-5 py-3 text-xs text-stone-400">${formatDate(u.createdAt)}</td>
      <td class="px-5 py-3">
        <div class="flex gap-1.5">
          <button onclick="changePlan('${u.id}', '${u.email}')" class="rounded px-2.5 py-1 text-xs bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors">Plan Değiştir</button>
          <button onclick="resetUsage('${u.id}')" class="rounded px-2.5 py-1 text-xs bg-stone-50 text-stone-600 hover:bg-stone-100 transition-colors">Sıfırla</button>
        </div>
      </td>
    </tr>`).join("");
}

window.filterUsers = function(q) {
  const filtered = allUsers.filter(u =>
    (u.email||"").toLowerCase().includes(q.toLowerCase()) ||
    (u.name||"").toLowerCase().includes(q.toLowerCase())
  );
  renderUsersTable(filtered);
};

window.changePlan = async function(uid, email) {
  const plan = prompt(`${email} için yeni plan (free/starter/pro):`);
  if (!plan || !["free","starter","pro"].includes(plan)) return;
  const limits = { free: 5, starter: 50, pro: 999 };
  await updateDoc(doc(db, "users", uid), { plan, usageLimit: limits[plan] });
  showToast("Plan güncellendi!");
  loadUsers();
};

window.resetUsage = async function(uid) {
  if (!confirm("Bu kullanıcının kullanım sayacını sıfırla?")) return;
  await updateDoc(doc(db, "users", uid), { usageCount: 0 });
  showToast("Kullanım sıfırlandı!");
  loadUsers();
};

// ─── PLANS ────────────────────────────────────────────────────────────────────
async function loadPlansAdmin() {
  const grid = document.getElementById("plans-admin-grid");
  grid.innerHTML = `<div class="col-span-3 text-center text-stone-400 py-8">Yükleniyor...</div>`;
  try {
    const snap = await getDocs(query(collection(db, "plans"), orderBy("price","asc")));
    let plans  = [];
    snap.forEach(d => plans.push({ id: d.id, ...d.data() }));
    if (plans.length === 0) plans = await seedDefaultPlans();
    renderPlansAdmin(plans);
  } catch(e) {
    grid.innerHTML = `<div class="col-span-3 text-center text-red-400 py-8">Hata: ${e.message}</div>`;
  }
}

async function seedDefaultPlans() {
  const defaults = [
    { name:"Ücretsiz", price:0, limit:5, color:"stone", featured:false, features:["5 AI kullanımı/ay","3 araça erişim","Topluluk desteği"] },
    { name:"Starter",  price:99, limit:50, color:"brand", featured:true, features:["50 AI kullanımı/ay","Tüm araçlara erişim","Öncelikli destek","Dışa aktarma"] },
    { name:"Pro",      price:249, limit:999, color:"amber", featured:false, features:["Sınırsız AI kullanımı","Tüm araçlara erişim","7/24 destek","API erişimi","Özel promptlar"] }
  ];
  const result = [];
  for (const p of defaults) {
    const ref = await addDoc(collection(db, "plans"), p);
    result.push({ id: ref.id, ...p });
  }
  return result;
}

function renderPlansAdmin(plans) {
  const grid = document.getElementById("plans-admin-grid");
  grid.innerHTML = plans.map(p => {
    const features = Array.isArray(p.features) ? p.features : (p.features||"").split("\n").filter(Boolean);
    return `
    <div class="admin-plan-card">
      <div class="flex items-start justify-between mb-3">
        <div>
          <span class="badge ${planBadgeClass(p.id)}">${p.name}</span>
          ${p.featured ? '<span class="ml-1 text-xs text-amber-500">⭐ Önerilen</span>' : ''}
        </div>
        <div class="flex gap-1">
          <button onclick='openPlanModal(${JSON.stringify(p)})' class="rounded p-1.5 text-stone-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button onclick="deletePlan('${p.id}')" class="rounded p-1.5 text-stone-400 hover:text-red-500 hover:bg-red-50 transition-colors">
            <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </div>
      </div>
      <p class="font-serif text-2xl text-stone-900 mb-1">${p.price == 0 ? 'Ücretsiz' : '₺'+p.price}<span class="text-xs font-sans text-stone-400">${p.price > 0 ? '/ay' : ''}</span></p>
      <p class="text-xs text-stone-500 mb-3">${p.limit} kullanım/ay</p>
      <ul class="space-y-1">
        ${features.map(f => `<li class="text-xs text-stone-600">• ${f}</li>`).join("")}
      </ul>
    </div>`;
  }).join("");
}

window.openPlanModal = function(plan = null) {
  document.getElementById("plan-modal-title").textContent = plan ? "Planı Düzenle" : "Yeni Plan";
  document.getElementById("plan-edit-id").value      = plan?.id || "";
  document.getElementById("plan-name").value         = plan?.name || "";
  document.getElementById("plan-price").value        = plan?.price ?? "";
  document.getElementById("plan-limit").value        = plan?.limit || "";
  const features = Array.isArray(plan?.features) ? plan.features.join("\n") : (plan?.features || "");
  document.getElementById("plan-features").value     = features;
  document.getElementById("plan-color").value        = plan?.color || "stone";
  document.getElementById("plan-featured").checked  = plan?.featured || false;
  document.getElementById("plan-modal").style.display = "flex";
};

window.closePlanModal = function() {
  document.getElementById("plan-modal").style.display = "none";
};

window.savePlan = async function() {
  const id       = document.getElementById("plan-edit-id").value;
  const name     = document.getElementById("plan-name").value.trim();
  const price    = parseFloat(document.getElementById("plan-price").value);
  const limit    = parseInt(document.getElementById("plan-limit").value);
  const features = document.getElementById("plan-features").value.split("\n").filter(Boolean);
  const color    = document.getElementById("plan-color").value;
  const featured = document.getElementById("plan-featured").checked;

  if (!name || isNaN(price) || isNaN(limit)) {
    showToast("Tüm alanları doldur!", "error");
    return;
  }

  const data = { name, price, limit, features, color, featured };

  try {
    if (id) {
      await setDoc(doc(db, "plans", id), data, { merge: true });
    } else {
      await addDoc(collection(db, "plans"), data);
    }
    closePlanModal();
    showToast("Plan kaydedildi!");
    loadPlansAdmin();
  } catch(e) {
    showToast("Kayıt hatası: " + e.message, "error");
  }
};

window.deletePlan = async function(id) {
  if (!confirm("Bu planı silmek istediğine emin misin?")) return;
  await deleteDoc(doc(db, "plans", id));
  showToast("Plan silindi.");
  loadPlansAdmin();
};

// ─── PAYMENTS ────────────────────────────────────────────────────────────────
async function loadPayments() {
  const tbody = document.getElementById("payments-table-body");
  tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-stone-400">Yükleniyor...</td></tr>`;
  try {
    const snap     = await getDocs(query(collection(db, "payments"), orderBy("createdAt","desc")));
    const payments = [];
    snap.forEach(d => payments.push({ id: d.id, ...d.data() }));

    if (payments.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-stone-400">Henüz ödeme yok.</td></tr>`;
      return;
    }

    tbody.innerHTML = payments.map(p => `
      <tr class="hover:bg-stone-50">
        <td class="px-5 py-3 text-xs text-stone-700">${p.email}</td>
        <td class="px-5 py-3"><span class="badge ${planBadgeClass(p.plan)}">${p.planName || p.plan}</span></td>
        <td class="px-5 py-3 text-xs font-semibold text-stone-800">₺${p.amount}</td>
        <td class="px-5 py-3 text-xs text-stone-400">${formatDate(p.createdAt)}</td>
        <td class="px-5 py-3"><span class="badge ${p.status === 'success' ? 'badge-success' : 'badge-error'}">${p.status}</span></td>
      </tr>`).join("");
  } catch(e) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-5 py-6 text-center text-red-400">Hata: ${e.message}</td></tr>`;
  }
}

// ─── SETTINGS ────────────────────────────────────────────────────────────────
async function loadSettings() {
  try {
    const [geminiSnap, iyzicoSnap, siteSnap] = await Promise.all([
      getDoc(doc(db, "settings", "gemini")),
      getDoc(doc(db, "settings", "iyzico")),
      getDoc(doc(db, "settings", "site"))
    ]);
    if (geminiSnap.exists()) {
      document.getElementById("settings-gemini-key").value = geminiSnap.data().apiKey || "";
    }
    if (iyzicoSnap.exists()) {
      document.getElementById("settings-iyzico-key").value    = iyzicoSnap.data().apiKey    || "";
      document.getElementById("settings-iyzico-secret").value = iyzicoSnap.data().secretKey || "";
      document.getElementById("settings-iyzico-sandbox").checked = iyzicoSnap.data().sandbox !== false;
    }
    if (siteSnap.exists()) {
      document.getElementById("settings-site-title").value      = siteSnap.data().title        || "";
      document.getElementById("settings-announcement").value    = siteSnap.data().announcement || "";
    }
  } catch(e) { /* settings not yet set */ }
}

window.saveSettings = async function(type) {
  try {
    if (type === "gemini") {
      const apiKey = document.getElementById("settings-gemini-key").value.trim();
      await setDoc(doc(db, "settings", "gemini"), { apiKey }, { merge: true });
    }
    if (type === "iyzico") {
      await setDoc(doc(db, "settings", "iyzico"), {
        apiKey:    document.getElementById("settings-iyzico-key").value.trim(),
        secretKey: document.getElementById("settings-iyzico-secret").value.trim(),
        sandbox:   document.getElementById("settings-iyzico-sandbox").checked
      }, { merge: true });
    }
    if (type === "site") {
      await setDoc(doc(db, "settings", "site"), {
        title:        document.getElementById("settings-site-title").value.trim(),
        announcement: document.getElementById("settings-announcement").value.trim()
      }, { merge: true });
    }
    showToast("Ayarlar kaydedildi!");
  } catch(e) {
    showToast("Kayıt hatası: " + e.message, "error");
  }
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function planBadgeClass(plan) {
  if (plan === "pro")     return "badge-premium";
  if (plan === "starter") return "badge-pro";
  return "badge-free";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("tr-TR", { day:"2-digit", month:"short", year:"numeric" });
}

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
