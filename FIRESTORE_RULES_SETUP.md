# إعداد Firestore Security Rules — خطوة أساسية لا تتجاهلها

## لماذا لا تظهر الشكاوى على الأجهزة الأخرى؟

**السبب الأول والأهم:** Firestore في المشاريع الجديدة يأتي بقواعد أمان تمنع القراءة والكتابة تلقائياً بعد 30 يوماً من الإنشاء — وفي بعض الإعدادات من اليوم الأول.

---

## الحل الفوري — اضبط Rules في Firebase Console

### الخطوات:

1. افتح [Firebase Console](https://console.firebase.google.com)
2. اختر مشروع **may2-ff7bd**
3. من القائمة الجانبية: **Firestore Database**
4. اضغط تبويب: **Rules**
5. **احذف** كل ما فيه واستبدله بهذا:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

6. اضغط **Publish**

---

## قائمة التحقق الكاملة من أسباب عدم الظهور

### 1. 🔒 Firestore Security Rules (الأكثر شيوعاً)
- القواعد تمنع الكتابة → الشكوى تُحفظ محلياً فقط
- الحل: الخطوات أعلاه

### 2. 🌐 لم يتم إنشاء Firestore Database أصلاً
- اذهب إلى Firebase Console → Firestore Database
- إذا طُلب منك "Create database" → افعل ذلك
- اختر **Start in test mode** مؤقتاً

### 3. 🔑 بيانات Firebase Config خاطئة
- تأكد أن `projectId` في main.js هو: `may2-ff7bd`
- تأكد أن `apiKey` صحيح

### 4. 📡 مشكلة في الشبكة / CORS
- الملف يُفتح مباشرة كـ `file://` بدلاً من رفعه على سيرفر
- Firebase لا يعمل على `file://` — يجب رفع الملفات على استضافة
- الحل: ارفع على Firebase Hosting أو أي سيرفر

### 5. 🔢 إصدار Firebase SDK قديم لا يتوافق مع المشروع الجديد
- تأكد أن الإصدار في main.js هو `12.13.0`

### 6. ⚡ اختبار سريع — افتح Developer Tools (F12)
ابحث في Console عن:
- ✅ `[Firebase] الاتصال بـ Firestore يعمل بنجاح` → الاتصال تمام
- ❌ `permission-denied` → مشكلة Rules (الحل أعلاه)
- ❌ `Failed to fetch` → مشكلة شبكة أو استضافة
