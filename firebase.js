/**
 * firebase.js — اي ام سبيشل
 * يُهيئ Firebase ويوفر قاعدة البيانات السحابية بديلاً عن localStorage
 *
 * البنية في Firestore:
 *   Collection: ims
 *     ├── config      → المستخدمون + الإعدادات
 *     ├── complaints  → { items: [...] }
 *     ├── messages    → { items: [...] } (رسائل عملاء البوابة)
 *     ├── branchMsgs  → { items: [...] } (رسائل الفروع + رسائل المالك owner_cast)
 *     └── warnings    → { items: [...] }
 */

import { initializeApp }     from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  initializeFirestore,
  persistentLocalCache,
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";

// ══════════════════════════════════════════════════════════════
//  1. إعداد Firebase
// ══════════════════════════════════════════════════════════════
const firebaseConfig = {
  apiKey:            "AIzaSyCeUsqDB-Hc_bnDOmjwRHettQPBe94hVW4",
  authDomain:        "comp2-ab6d9.firebaseapp.com",
  projectId:         "comp2-ab6d9",
  storageBucket:     "comp2-ab6d9.firebasestorage.app",
  messagingSenderId: "902613745123",
  appId:             "1:902613745123:web:356a46934db25803d274d6",
};

const app = initializeApp(firebaseConfig);

/**
 * تفعيل التخزين المؤقت المحلي (IndexedDB) بحيث يعمل التطبيق
 * حتى بدون اتصال بالإنترنت، وتُرسَل التغييرات فور عودة الشبكة.
 */
const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
});

// ══════════════════════════════════════════════════════════════
//  2. دوال مساعدة للقراءة والكتابة
// ══════════════════════════════════════════════════════════════
const COL = "ims";

async function loadDoc(key) {
  try {
    const snap = await getDoc(doc(db, COL, key));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn(`[DB] تعذّر تحميل "${key}":`, err);
    return null;
  }
}

async function saveDoc(key, data) {
  try {
    await setDoc(doc(db, COL, key), data);
  } catch (err) {
    console.error(`[DB] تعذّر حفظ "${key}":`, err);
  }
}

// ══════════════════════════════════════════════════════════════
//  3. واجهة قاعدة البيانات المكشوفة عبر window.DB
// ══════════════════════════════════════════════════════════════
window.DB = {
  saveConfig(payload) {
    return saveDoc("config", {
      users:           payload.users           ?? [],
      ctypes:          payload.ctypes          ?? [],
      sentiments:      payload.sentiments      ?? [],
      demos:           payload.demos           ?? [],
      employees:       payload.employees       ?? {},
      branchWA:        payload.branchWA        ?? {},
      adminWANum:      payload.adminWANum      ?? "",
      maintPass:       payload.maintPass       ?? "010",
      signatureBase64: payload.signatureBase64 ?? "",
    });
  },
  saveComplaints: (items) => saveDoc("complaints",  { items }),
  saveMessages:   (items) => saveDoc("messages",    { items }),
  saveBranchMsgs: (items) => saveDoc("branchMsgs",  { items }),
  saveWarnings:   (items) => saveDoc("warnings",    { items }),
};

// ══════════════════════════════════════════════════════════════
//  4. التحميل الأولي: Firestore → localStorage → app.js
// ══════════════════════════════════════════════════════════════
async function syncFirestoreToLocalStorage() {
  const [configR, complaintsR, messagesR, branchMsgsR, warningsR] =
    await Promise.allSettled([
      loadDoc("config"),
      loadDoc("complaints"),
      loadDoc("messages"),
      loadDoc("branchMsgs"),
      loadDoc("warnings"),
    ]);

  const cfg = configR.value;
  if (cfg) {
    if (cfg.users)           localStorage.setItem("ims_u",       JSON.stringify(cfg.users));
    if (cfg.ctypes)          localStorage.setItem("ims_ct",      JSON.stringify(cfg.ctypes));
    if (cfg.sentiments)      localStorage.setItem("ims_sent",    JSON.stringify(cfg.sentiments));
    if (cfg.demos)           localStorage.setItem("ims_demo",    JSON.stringify(cfg.demos));
    if (cfg.employees)       localStorage.setItem("ims_emp",     JSON.stringify(cfg.employees));
    if (cfg.branchWA)        localStorage.setItem("ims_bwa",     JSON.stringify(cfg.branchWA));
    if (cfg.adminWANum)      localStorage.setItem("ims_adminwa", cfg.adminWANum);
    if (cfg.maintPass)       localStorage.setItem("ims_mp",      cfg.maintPass);
    if (cfg.signatureBase64) localStorage.setItem("ims_sig",     cfg.signatureBase64);
  }

  const cd = complaintsR.value;
  if (cd?.items) localStorage.setItem("ims_c",  JSON.stringify(cd.items));

  const md = messagesR.value;
  if (md?.items) localStorage.setItem("ims_m",  JSON.stringify(md.items));

  const bmd = branchMsgsR.value;
  if (bmd?.items) localStorage.setItem("ims_bm", JSON.stringify(bmd.items));

  const wd = warningsR.value;
  if (wd?.items) localStorage.setItem("ims_w",  JSON.stringify(wd.items));
}

// ══════════════════════════════════════════════════════════════
//  5. التحديثات الفورية (Real-time listeners)
// ══════════════════════════════════════════════════════════════
function setupRealtimeListeners() {
  const watchDoc = (key, localKey, syncKey) => {
    onSnapshot(doc(db, COL, key), (snap) => {
      if (!snap.exists()) return;
      const items = snap.data().items ?? [];
      localStorage.setItem(localKey, JSON.stringify(items));
      window._imsSync?.(syncKey, items);
    });
  };

  watchDoc("complaints",  "ims_c",  "complaints");
  watchDoc("messages",    "ims_m",  "messages");
  watchDoc("branchMsgs",  "ims_bm", "branchMsgs");
  watchDoc("warnings",    "ims_w",  "warnings");
}

// ══════════════════════════════════════════════════════════════
//  6. نقطة البداية
// ══════════════════════════════════════════════════════════════
try {
  await syncFirestoreToLocalStorage();
} catch (err) {
  console.warn("[DB] تعذّر التزامن الأولي، سيُستخدم localStorage:", err);
}

const appScript   = document.createElement("script");
appScript.src     = "app.js";
appScript.onload  = () => setupRealtimeListeners();
appScript.onerror = () => console.error("[DB] تعذّر تحميل app.js");
document.body.appendChild(appScript);
