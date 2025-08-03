import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

// إعدادات Firebase للتطبيق، يتم تحميلها من متغيرات البيئة لزيادة الأمان.
// هذا يمنع كشف المفاتيح الحساسة في الكود المصدري المنشور.
// تأكد من وجود ملف .env.local في جذر المشروع يحتوي على هذه المتغيرات.
const firebaseConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
    measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID
};

// التحقق من وجود متغيرات البيئة الضرورية قبل تهيئة Firebase
// هذا يضمن أن التطبيق لن يفشل بصمت إذا لم يتم تكوين ملف .env بشكل صحيح.
if (!firebaseConfig.apiKey || !firebaseConfig.projectId) {
    throw new Error("Firebase configuration is missing. Make sure to set up your .env.local file.");
}

// تهيئة Firebase وتصدير المثيلات.
// استخدام const يضمن عدم إعادة تعيين هذه المتغيرات عن طريق الخطأ في مكان آخر.
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// تهيئة التحليلات بشكل شرطي باستخدام العامل الثلاثي (ternary operator) لمزيد من الإيجاز.
const analytics = firebaseConfig.measurementId ? getAnalytics(app) : undefined;

// تصدير مثيلات Firebase للاستخدام في جميع أنحاء التطبيق
export { auth, db, firebaseConfig, analytics };
