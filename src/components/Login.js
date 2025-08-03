// src/pages/LoginPage.js
import React, { useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { auth, db } from "../firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from '../contexts/AuthContext'; // استيراد useAuth لجلب getDashboardPath
import '../Styles/LoginStyles.css'; // استيراد ملف التنسيقات الخارجي
import '../Styles/AuthForm.css'; // تأكد من استيراد هذا الملف للأنماط المشتركة

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [loading, setLoading] = useState(false); // إضافة حالة التحميل
    const navigate = useNavigate();
    // جلب دالة getDashboardPath من AuthContext
    const { getDashboardPath } = useAuth();

    // دالة للتحقق من صحة تنسيق البريد الإلكتروني
    const isValidEmail = (email) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    // دالة لتسجيل الدخول
    const handleLogin = useCallback(async (e) => {
        e.preventDefault();
        setError(""); // مسح رسائل الخطأ السابقة
        setMessage(""); // مسح رسائل النجاح السابقة

        // التحقق من صحة المدخلات قبل محاولة تسجيل الدخول
        if (!isValidEmail(email)) {
            setError("يرجى إدخال بريد إلكتروني صحيح.");
            return;
        }
        if (password.length < 6) {
            setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
            return;
        }

        setLoading(true); // بدء التحميل
        try {
            // محاولة تسجيل الدخول باستخدام البريد الإلكتروني وكلمة المرور
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // جلب دور المستخدم من Firestore بعد تسجيل الدخول بنجاح
            const userDocRef = doc(db, "users", user.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
                const userRole = userDocSnap.data().role;
                // توجيه المستخدم إلى لوحة التحكم المناسبة لدوره باستخدام الدالة من AuthContext
                navigate(getDashboardPath(userRole));
            } else {
                // إذا لم يتم العثور على دور المستخدم في Firestore، فهذا يشير إلى مشكلة في البيانات
                setError("لم يتم العثور على دور المستخدم. يرجى الاتصال بالدعم.");
                await auth.signOut(); // تسجيل الخروج للحفاظ على الأمان
            }
        } catch (err) {
            console.error("Login error:", err);
            // التعامل مع أخطاء تسجيل الدخول وعرض رسائل واضحة للمستخدم
            switch (err.code) {
                case 'auth/user-not-found':
                case 'auth/wrong-password':
                case 'auth/invalid-credential': // يشمل الخطأين السابقين في بعض إصدارات Firebase
                    setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.');
                    break;
                case 'auth/invalid-email':
                    setError('تنسيق البريد الإلكتروني غير صالح.');
                    break;
                case 'auth/too-many-requests':
                    setError('تم حظر حسابك مؤقتًا بسبب محاولات تسجيل دخول فاشلة متعددة. يرجى المحاولة لاحقًا.');
                    break;
                case 'auth/user-disabled':
                    setError('تم تعطيل هذا الحساب. يرجى الاتصال بالدعم.');
                    break;
                default:
                    setError('فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.');
            }
        } finally {
            setLoading(false); // إنهاء التحميل في كل الأحوال
        }
    }, [email, password, navigate, getDashboardPath]); // الاعتماديات لدالة useCallback

    // دالة لإعادة تعيين كلمة المرور
    const handleResetPassword = useCallback(async () => {
        setError(""); // مسح رسائل الخطأ السابقة
        setMessage(""); // مسح رسائل النجاح السابقة

        // التحقق من وجود البريد الإلكتروني قبل إرسال رابط إعادة التعيين
        if (!email.trim()) {
            setError("يرجى إدخال بريدك الإلكتروني لإعادة تعيين كلمة المرور.");
            return;
        }
        if (!isValidEmail(email)) {
            setError("يرجى إدخال بريد إلكتروني صحيح لإعادة تعيين كلمة المرور.");
            return;
        }

        setLoading(true); // بدء التحميل
        try {
            // إرسال رابط إعادة تعيين كلمة المرور
            await sendPasswordResetEmail(auth, email);
            setMessage("تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد والبريد المزعج.");
        } catch (err) {
            console.error("Password reset error:", err);
            // التعامل مع أخطاء إعادة تعيين كلمة المرور
            switch (err.code) {
                case 'auth/user-not-found':
                    setError('لا يوجد مستخدم بهذا البريد الإلكتروني.');
                    break;
                case 'auth/invalid-email':
                    setError('تنسيق البريد الإلكتروني غير صالح.');
                    break;
                default:
                    setError('فشل في إرسال رابط إعادة تعيين كلمة المرور. يرجى المحاولة مرة أخرى.');
            }
        } finally {
            setLoading(false); // إنهاء التحميل في كل الأحوال
        }
    }, [email]); // الاعتماديات لدالة useCallback

    return (
        <div className="auth-container">
            <div className="auth-form-card">
                <h2 className="login-title">تسجيل دخول المعلم / ولي الأمر</h2>
                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label htmlFor="email-input">البريد الإلكتروني:</label>
                        <input
                            type="email"
                            id="email-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="form-input"
                            disabled={loading} // تعطيل الإدخال أثناء التحميل
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password-input">كلمة المرور:</label>
                        <input
                            type="password"
                            id="password-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="form-input"
                            disabled={loading} // تعطيل الإدخال أثناء التحميل
                        />
                    </div>
                    {/* عرض رسائل الخطأ والنجاح */}
                    {error && <div className="error-message">{error}</div>}
                    {message && <div className="success-message">{message}</div>}
                    <button type="submit" className="login-button" disabled={loading}>
                        {loading ? 'جاري تسجيل الدخول...' : 'تسجيل الدخول'}
                    </button>
                </form>
                <button
                    onClick={handleResetPassword}
                    className="reset-password-button"
                    disabled={loading} // تعطيل الزر أثناء التحميل
                >
                    نسيت كلمة المرور؟
                </button>
                <div className="auth-link">
                    ليس لديك حساب؟ <Link to="/register">سجل الآن</Link>
                </div>
            </div>
        </div>
    );
}
