/**
 * firebase.js — اي ام سبيشل
 * يُهيئ Firebase ويوفر قاعدة البيانات السحابية بديلاً عن localStorage
 *
 * البنية في Firestore:
 *   Collection: ims
 *     ├── config      → المستخدمون + الإعدادات
 *     ├── complaints  → { items: [...] }
 *     ├── messages    → { items: [...] }
 *     ├── branchMsgs  → { items: [...] }
 *     └── warnings    → { items: [...] }
 */

import { initializeApp }     from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics }      from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";
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
  apiKey:            "AIzaSyA0kcj6C_PgrSBfmZ0DE3w0CVQEq5y8WZU",
  authDomain:        "comp-100d1.firebaseapp.com",
  projectId:         "comp-100d1",
  storageBucket:     "comp-100d1.firebasestorage.app",
  messagingSenderId: "427417913381",
  appId:             "1:427417913381:web:80262b33c432cc540197cc",
  measurementId:     "G-P0XWTP6MTD",
};

const app = initializeApp(firebaseConfig);
getAnalytics(app);

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
const COL = "ims"; // اسم المجموعة الرئيسية

/** تحميل وثيقة من Firestore — يُعيد null عند الخطأ أو الغياب */
async function loadDoc(key) {
  try {
    const snap = await getDoc(doc(db, COL, key));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn(`[DB] تعذّر تحميل "${key}":`, err);
    return null;
  }
}

/** حفظ وثيقة في Firestore — يسجّل الخطأ ولا يوقف التطبيق */
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

/**
 * window.DB — يستخدمها app.js لحفظ البيانات في السحابة
 * جميع العمليات غير متزامنة (fire-and-forget) لضمان عدم تعطّل الواجهة
 */
window.DB = {
  /** حفظ الإعدادات والمستخدمين والقوائم */
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

/**
 * يُحمّل جميع الوثائق من Firestore بالتوازي ثم يكتبها في localStorage
 * حتى يجدها app.js عند تشغيله كأنها بيانات محلية.
 * في حال فشل الاتصال تُستخدم البيانات المحلية كاحتياطي تلقائي.
 */
async function syncFirestoreToLocalStorage() {
  const [configR, complaintsR, messagesR, branchMsgsR, warningsR] =
    await Promise.allSettled([
      loadDoc("config"),
      loadDoc("complaints"),
      loadDoc("messages"),
      loadDoc("branchMsgs"),
      loadDoc("warnings"),
    ]);

  // الإعدادات والمستخدمين
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

  // الشكاوى
  const cd = complaintsR.value;
  if (cd?.items) localStorage.setItem("ims_c", JSON.stringify(cd.items));

  // رسائل العملاء
  const md = messagesR.value;
  if (md?.items) localStorage.setItem("ims_m", JSON.stringify(md.items));

  // رسائل الفروع
  const bmd = branchMsgsR.value;
  if (bmd?.items) localStorage.setItem("ims_bm", JSON.stringify(bmd.items));

  // الإنذارات
  const wd = warningsR.value;
  if (wd?.items) localStorage.setItem("ims_w", JSON.stringify(wd.items));
}

// ══════════════════════════════════════════════════════════════
//  5. التحديثات الفورية (Real-time listeners)
// ══════════════════════════════════════════════════════════════

/**
 * بعد تشغيل app.js، يُضاف مستمع لكل وثيقة رئيسية.
 * عند تغيير أي وثيقة من جهاز آخر:
 *   1. تُحدَّث localStorage كاحتياطي محلي
 *   2. يُستدعى window._imsSync لتحديث الواجهة فوراً
 */
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

  // مراقبة تغييرات الإعدادات في الوقت الفعلي
  onSnapshot(doc(db, COL, "config"), (snap) => {
    if (!snap.exists()) return;
    const cfg = snap.data();
    if (cfg.users)           localStorage.setItem("ims_u",       JSON.stringify(cfg.users));
    if (cfg.ctypes)          localStorage.setItem("ims_ct",      JSON.stringify(cfg.ctypes));
    if (cfg.sentiments)      localStorage.setItem("ims_sent",    JSON.stringify(cfg.sentiments));
    if (cfg.demos)           localStorage.setItem("ims_demo",    JSON.stringify(cfg.demos));
    if (cfg.employees)       localStorage.setItem("ims_emp",     JSON.stringify(cfg.employees));
    if (cfg.branchWA)        localStorage.setItem("ims_bwa",     JSON.stringify(cfg.branchWA));
    if (cfg.adminWANum != null) localStorage.setItem("ims_adminwa", cfg.adminWANum);
    if (cfg.maintPass  != null) localStorage.setItem("ims_mp",      cfg.maintPass);
    if (cfg.signatureBase64 != null) localStorage.setItem("ims_sig", cfg.signatureBase64);
    window._imsSync?.("config", cfg);
  });
}

// ══════════════════════════════════════════════════════════════
//  6. نقطة البداية — تُشغَّل مرة واحدة عند تحميل الصفحة
// ══════════════════════════════════════════════════════════════
try {
  await syncFirestoreToLocalStorage();
} catch (err) {
  // الاحتياطي: app.js سيقرأ من localStorage كالمعتاد
  console.warn("[DB] تعذّر التزامن الأولي، سيُستخدم localStorage:", err);
}

// تحميل app.js ديناميكياً بعد اكتمال بيانات Firestore
const appScript    = document.createElement("script");
appScript.src      = "app.js";
appScript.onload   = () => setupRealtimeListeners();
appScript.onerror  = () => console.error("[DB] تعذّر تحميل app.js");
document.body.appendChild(appScript);
