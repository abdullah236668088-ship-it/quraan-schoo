// src/pages/RegisterPage.js
import React, { useState, useCallback } from 'react'; // إضافة useCallback
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import '../Styles/AuthForm.css'; // Reuse existing styles or create new ones
import CustomModal from '../components/CustomModal'; // استيراد مكون المودال المخصص

export default function RegisterPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(''); // رسالة للنجاح
    const { register } = useAuth();
    const navigate = useNavigate();

    // حالات المودال
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // دالة للتحقق من صحة تنسيق البريد الإلكتروني
    const isValidEmail = (email) => {
        return /\S+@\S+\.\S+/.test(email);
    };

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError(''); // مسح الأخطاء السابقة
        setMessage(''); // مسح الرسائل السابقة

        if (!isValidEmail(email)) {
            setError("يرجى إدخال بريد إلكتروني صحيح.");
            return;
        }

        if (password !== confirmPassword) {
            return setError('كلمتا المرور غير متطابقتين.');
        }

        if (password.length < 6) {
            return setError('يجب أن تكون كلمة المرور 6 أحرف على الأقل.');
        }

        setLoading(true); // بدء التحميل
        try {
            await register(email, password);
            // بدلاً من alert، استخدم CustomModal
            setModalConfig({
                title: "تسجيل ناجح",
                message: "تم تسجيل حسابك بنجاح! يمكنك الآن تسجيل الدخول.",
                onConfirm: () => {
                    setShowModal(false);
                    navigate('/login'); // التوجيه إلى صفحة تسجيل الدخول بعد تأكيد المودال
                },
                showCancelButton: false, // لا حاجة لزر الإلغاء هنا
            });
            setShowModal(true);
        } catch (err) {
            console.error("Registration error:", err);
            // Firebase error codes for user-friendly messages
            if (err.code === 'auth/email-already-in-use') {
                setError('هذا البريد الإلكتروني مستخدم بالفعل.');
            } else if (err.code === 'auth/invalid-email') {
                setError('تنسيق البريد الإلكتروني غير صالح.');
            } else if (err.code === 'auth/weak-password') {
                setError('كلمة المرور ضعيفة جدًا. يرجى اختيار كلمة مرور أقوى.');
            } else {
                setError('فشل التسجيل. يرجى المحاولة مرة أخرى.');
            }
        } finally {
            setLoading(false); // إنهاء التحميل
        }
    }, [email, password, confirmPassword, register, navigate]);

    return (
        <div className="auth-container">
            <div className="auth-form-card">
                <h2 className="auth-title">تسجيل حساب جديد</h2>
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="email">البريد الإلكتروني:</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="form-input"
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">كلمة المرور:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="form-input"
                            disabled={loading}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirm-password">تأكيد كلمة المرور:</label>
                        <input
                            type="password"
                            id="confirm-password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="form-input"
                            disabled={loading}
                        />
                    </div>
                    {error && <div className="error-message">{error}</div>}
                    {message && <div className="success-message">{message}</div>} {/* لعرض رسائل النجاح */}
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'جاري التسجيل...' : 'تسجيل'}
                    </button>
                </form>
                <div className="auth-link">
                    لديك حساب بالفعل؟ <Link to="/login">تسجيل الدخول</Link>
                </div>
            </div>

            {/* مودال التأكيد/النجاح */}
            <CustomModal
                isOpen={showModal}
                title={modalConfig.title}
                message={modalConfig.message}
                onConfirm={modalConfig.onConfirm}
                onCancel={modalConfig.onCancel}
                showCancelButton={modalConfig.showCancelButton}
            />
        </div>
    );
}
