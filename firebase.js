/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║           firebase.js — IMS Special  •  v6.0.0                  ║
 * ║  طبقة Firebase الكاملة: إعداد، قراءة، كتابة، مزامنة فورية       ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  البنية في Firestore (Collection: "ims")                         ║
 * ║   ┌─ config     → { users, ctypes, sentiments, demos,           ║
 * ║   │               employees, branchWA, adminWANum,              ║
 * ║   │               maintPass, signatureBase64 }                  ║
 * ║   ├─ complaints → { items: [...] }                              ║
 * ║   ├─ messages   → { items: [...] }                              ║
 * ║   ├─ branchMsgs → { items: [...] }                              ║
 * ║   └─ warnings   → { items: [...] }                              ║
 * ╠══════════════════════════════════════════════════════════════════╣
 * ║  الواجهة المكشوفة لـ app.js                                      ║
 * ║   • window.DB              — دوال الحفظ إلى Firestore            ║
 * ║   • window._imsSync        — تُعرَّف في app.js، تُستدعى هنا      ║
 * ║   • window._session_ready  — علامة: هل الجلسة نشطة؟             ║
 * ║   • window._imsFlushPending — تصريف التحديثات المعلّقة           ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 1 — استيراد Firebase SDK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
import { initializeApp }  from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import { getAnalytics }   from "https://www.gstatic.com/firebasejs/12.12.1/firebase-analytics.js";
import {
  initializeFirestore,
  persistentLocalCache,
  doc, setDoc, getDoc, onSnapshot,
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-firestore.js";


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 2 — تهيئة Firebase والاتصال بـ Firestore
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const _config = {
  apiKey:            "AIzaSyA0kcj6C_PgrSBfmZ0DE3w0CVQEq5y8WZU",
  authDomain:        "comp-100d1.firebaseapp.com",
  projectId:         "comp-100d1",
  storageBucket:     "comp-100d1.firebasestorage.app",
  messagingSenderId: "427417913381",
  appId:             "1:427417913381:web:80262b33c432cc540197cc",
  measurementId:     "G-P0XWTP6MTD",
};

const _app = initializeApp(_config);
getAnalytics(_app);

/**
 * persistentLocalCache: يخزّن البيانات في IndexedDB
 * → التطبيق يعمل offline، والتغييرات ترسل عند عودة الشبكة
 */
const _db  = initializeFirestore(_app, { localCache: persistentLocalCache() });
const _COL = "ims";   // اسم المجموعة الرئيسية
const _ref = (key) => doc(_db, _COL, key);


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 3 — دوال القراءة والكتابة الأساسية (خاصة بهذا الملف)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * _load(key) — يقرأ وثيقة من Firestore
 * @returns {Object|null} بيانات الوثيقة، أو null عند غيابها أو خطأ
 */
async function _load(key) {
  try {
    const snap = await getDoc(_ref(key));
    return snap.exists() ? snap.data() : null;
  } catch (err) {
    console.warn(`[DB] قراءة "${key}" فشلت:`, err.message);
    return null;
  }
}

/**
 * _save(key, data) — يكتب وثيقة إلى Firestore
 * يستخدم merge:false (setDoc) لاستبدال الوثيقة كاملاً في كل مرة
 */
async function _save(key, data) {
  try {
    await setDoc(_ref(key), data);
  } catch (err) {
    console.error(`[DB] كتابة "${key}" فشلت:`, err.message);
  }
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 4 — واجهة window.DB  (تُستخدَم من app.js لحفظ البيانات)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
window.DB = {

  /**
   * saveConfig — يحفظ الإعدادات العامة والمستخدمين وكل القوائم
   * يُطبَّق schema ثابت لتجنب حقول مجهولة في Firestore
   */
  saveConfig(p) {
    return _save("config", {
      users:           p.users           ?? [],
      ctypes:          p.ctypes          ?? [],
      sentiments:      p.sentiments      ?? [],
      demos:           p.demos           ?? [],
      employees:       p.employees       ?? {},
      branchWA:        p.branchWA        ?? {},
      adminWANum:      p.adminWANum      ?? "",
      maintPass:       p.maintPass       ?? "010",
      signatureBase64: p.signatureBase64 ?? "",
    });
  },

  /** saveComplaints — يحفظ مصفوفة الشكاوى كاملة */
  saveComplaints : (items) => _save("complaints",  { items }),

  /** saveMessages — يحفظ رسائل العملاء */
  saveMessages   : (items) => _save("messages",    { items }),

  /** saveBranchMsgs — يحفظ رسائل الفروع والإشعارات */
  saveBranchMsgs : (items) => _save("branchMsgs",  { items }),

  /** saveWarnings — يحفظ الإنذارات */
  saveWarnings   : (items) => _save("warnings",    { items }),
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 5 — التحميل الأولي: Firestore ← ← ← localStorage ← ← ← app.js
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * _applyConfig — يكتب حقول الـ config إلى localStorage
 * (دالة مشتركة بين التحميل الأولي والمستمع الفوري)
 */
function _applyConfig(cfg) {
  if (!cfg) return;
  const set = (k, v) => v != null && localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v));
  set("ims_u",       cfg.users);
  set("ims_ct",      cfg.ctypes);
  set("ims_sent",    cfg.sentiments);
  set("ims_demo",    cfg.demos);
  set("ims_emp",     cfg.employees);
  set("ims_bwa",     cfg.branchWA);
  set("ims_adminwa", cfg.adminWANum);
  set("ims_mp",      cfg.maintPass);
  set("ims_sig",     cfg.signatureBase64);
}

/**
 * _pullAll — يجلب جميع الوثائق من Firestore بالتوازي
 * ويكتبها في localStorage حتى يجدها app.js جاهزة عند بدء التشغيل.
 *
 * السيناريو: المستخدم يفتح الصفحة أو يُحدِّثها →
 *   1. firebase.js يجلب أحدث البيانات من Firestore
 *   2. يكتبها في localStorage
 *   3. يُحمِّل app.js الذي يقرأ من localStorage كالمعتاد
 * النتيجة: البيانات دائماً محدَّثة عند تحديث الصفحة
 */
async function _pullAll() {
  const [cfgR, cmpR, msgR, bmR, wrnR] = await Promise.allSettled([
    _load("config"),
    _load("complaints"),
    _load("messages"),
    _load("branchMsgs"),
    _load("warnings"),
  ]);

  _applyConfig(cfgR.value);

  if (cmpR.value?.items) localStorage.setItem("ims_c",  JSON.stringify(cmpR.value.items));
  if (msgR.value?.items) localStorage.setItem("ims_m",  JSON.stringify(msgR.value.items));
  if (bmR.value?.items)  localStorage.setItem("ims_bm", JSON.stringify(bmR.value.items));
  if (wrnR.value?.items) localStorage.setItem("ims_w",  JSON.stringify(wrnR.value.items));

  console.info("[DB] ✓ تم تحميل البيانات من Firestore");
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 6 — المزامنة الفورية (Real-time Listeners)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * طابور التحديثات المعلّقة:
 * يخزّن التحديثات التي تصل من Firestore قبل تسجيل دخول الموظف.
 * عند الدخول تُصرَّف دفعةً واحدة عبر _imsFlushPending().
 * يُحتفظ فقط بآخر تحديث لكل مفتاح (آخر يكسب).
 */
window._imsPendingSync = [];

/** _queueOrApply — يطبّق التحديث فوراً أو يضعه في الطابور */
function _queueOrApply(key, data) {
  if (window._imsSync && window._session_ready) {
    // الجلسة نشطة → تحديث فوري للواجهة
    window._imsSync(key, data);
  } else {
    // قبل تسجيل الدخول → خزّن لتطبيقه لاحقاً
    window._imsPendingSync = window._imsPendingSync.filter(p => p.key !== key);
    window._imsPendingSync.push({ key, data });
  }
}

/**
 * _watchItems — يراقب وثيقة ذات حقل items[]
 *
 * سلوك أول snapshot:
 *   Firestore يُطلق onSnapshot فوراً بالبيانات الحالية.
 *   نحن حمّلناها بالفعل في _pullAll، لذا نتخطّى أول إشعار.
 *   ما يليه = تحديثات حقيقية من أجهزة أخرى.
 *
 * @param {string} fsKey    - اسم الوثيقة في Firestore
 * @param {string} lsKey    - مفتاح localStorage
 * @param {string} syncKey  - المفتاح المُمرَّر لـ _imsSync
 */
function _watchItems(fsKey, lsKey, syncKey) {
  let initialized = false;
  onSnapshot(_ref(fsKey), (snap) => {
    if (!snap.exists()) return;
    const items = snap.data().items ?? [];

    // ① دائماً حدّث localStorage (يضمن صحة البيانات حتى قبل الدخول)
    localStorage.setItem(lsKey, JSON.stringify(items));

    // ② تخطّ أول snapshot (هي البيانات التي جلبناها في _pullAll)
    if (!initialized) { initialized = true; return; }

    // ③ تحديث حقيقي — طبّق أو خزّن
    _queueOrApply(syncKey, items);
  }, (err) => console.warn(`[DB] مستمع "${fsKey}" خطأ:`, err.message));
}

/**
 * _watchConfig — يراقب وثيقة الإعدادات بنفس المنطق
 */
function _watchConfig() {
  let initialized = false;
  onSnapshot(_ref("config"), (snap) => {
    if (!snap.exists()) return;
    const cfg = snap.data();

    // ① حدّث localStorage دائماً
    _applyConfig(cfg);

    // ② تخطّ أول snapshot
    if (!initialized) { initialized = true; return; }

    // ③ تحديث حقيقي
    _queueOrApply("config", cfg);
  }, (err) => console.warn("[DB] مستمع config خطأ:", err.message));
}

/**
 * _startListeners — يُشغَّل مرة واحدة بعد تحميل app.js
 * يبدأ المستمعين الفوريين لجميع الوثائق
 */
function _startListeners() {
  _watchItems("complaints",  "ims_c",  "complaints");
  _watchItems("messages",    "ims_m",  "messages");
  _watchItems("branchMsgs",  "ims_bm", "branchMsgs");
  _watchItems("warnings",    "ims_w",  "warnings");
  _watchConfig();
  console.info("[DB] ✓ المستمعون الفوريون نشطون");
}


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 7 — واجهة التحكم في الجلسة (تُستدعى من app.js)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * window._session_ready
 * false = شاشة الدخول (التحديثات تُخزَّن في الطابور)
 * true  = داخل التطبيق (التحديثات تُطبَّق فوراً على الواجهة)
 * يُضبط في app.js: true عند initApp()، false عند logout()
 */
window._session_ready = false;

/**
 * window._imsFlushPending()
 * تُستدعى من app.js مباشرةً بعد نجاح تسجيل الدخول.
 * تُصرِّف كل التحديثات المعلّقة دفعةً واحدة بالترتيب.
 */
window._imsFlushPending = () => {
  const queue = window._imsPendingSync.splice(0);
  if (queue.length) {
    console.info(`[DB] تصريف ${queue.length} تحديث معلّق`);
    queue.forEach(({ key, data }) => window._imsSync?.(key, data));
  }
};


// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  § 8 — نقطة البداية (تُنفَّذ مرة واحدة عند تحميل الصفحة)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

/**
 * الترتيب:
 *  1. جلب أحدث البيانات من Firestore وكتابتها في localStorage  ← _pullAll()
 *  2. تحميل app.js (يقرأ من localStorage فيجد بيانات محدّثة)
 *  3. بعد تحميل app.js، تفعيل المستمعين الفوريين              ← _startListeners()
 *
 * الاحتياطي:
 *  إذا فشل _pullAll (انقطاع الشبكة) → يُحمَّل app.js من localStorage كالمعتاد
 *  وستُرسَل التغييرات المعلّقة فور عودة الاتصال (persistentLocalCache)
 */
try {
  await _pullAll();
} catch (err) {
  console.warn("[DB] ⚠ فشل التحميل الأولي — سيُستخدَم localStorage:", err.message);
}

// تحميل app.js ديناميكياً بعد جاهزية البيانات
const _script    = document.createElement("script");
_script.src      = "app.js";
_script.onload   = () => _startListeners();
_script.onerror  = () => console.error("[DB] ✗ تعذّر تحميل app.js");
document.body.appendChild(_script);
