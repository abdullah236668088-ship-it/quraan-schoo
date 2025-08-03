// src/pages/UserProfilePage.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig'; // استيراد db
import { doc, getDoc, updateDoc } from 'firebase/firestore'; // استيراد doc, getDoc, updateDoc
import { getAuth, sendPasswordResetEmail } from 'firebase/auth'; // استيراد sendPasswordResetEmail
import CustomModal from '../components/CustomModal'; // استيراد مكون المودال المخصص
import '../Styles/UserProfilePageStyles.css'; // استيراد ملف التنسيقات

export default function UserProfilePage() {
    const { currentUser, userRole, loading: authLoading } = useAuth();
    const firebaseAuth = getAuth(); // الحصول على كائن المصادقة من Firebase

    const [profileName, setProfileName] = useState('');
    const [associatedHalaqat, setAssociatedHalaqat] = useState([]); // للمعلمين
    const [associatedStudents, setAssociatedStudents] = useState([]); // لأولياء الأمور/الضيوف
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [isEditingName, setIsEditingName] = useState(false);

    // حالات المودال
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // دالة لجلب بيانات الملف الشخصي من Firestore
    const fetchUserProfile = useCallback(async () => {
        if (!currentUser || authLoading) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError('');
        setMessage(''); // مسح الرسائل السابقة
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);
            if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                setProfileName(userData.name || currentUser.displayName || currentUser.email);

                // جلب أسماء الحلقات/الطلاب المرتبطة
                if (userData.role === 'teacher' && userData.associatedHalaqat && userData.associatedHalaqat.length > 0) {
                    const halaqatPromises = userData.associatedHalaqat.map(id => getDoc(doc(db, 'halaqat', id)));
                    const halaqatSnaps = await Promise.all(halaqatPromises);
                    const names = halaqatSnaps.map(snap => snap.exists() ? snap.data().name : 'حلقة غير معروفة');
                    setAssociatedHalaqat(names);
                } else {
                    setAssociatedHalaqat([]);
                }

                if (userData.role === 'guest' && userData.associatedStudents && userData.associatedStudents.length > 0) {
                    const studentsPromises = userData.associatedStudents.map(id => getDoc(doc(db, 'students', id)));
                    const studentsSnaps = await Promise.all(studentsPromises);
                    const names = studentsSnaps.map(snap => snap.exists() ? snap.data().name : 'طالب غير معروف');
                    setAssociatedStudents(names);
                } else {
                    setAssociatedStudents([]);
                }

            } else {
                setProfileName(currentUser.displayName || currentUser.email); // استخدام الاسم من Auth إذا لم يكن في Firestore
            }
        } catch (err) {
            console.error("Error fetching user profile:", err);
            setError('فشل جلب بيانات الملف الشخصي: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser, authLoading]);

    useEffect(() => {
        fetchUserProfile();
    }, [fetchUserProfile]);

    // دالة لتحديث اسم الملف الشخصي
    const handleUpdateProfileName = useCallback(async () => {
        setError('');
        setMessage('');
        if (!profileName.trim()) {
            setError('الاسم لا يمكن أن يكون فارغاً.');
            return;
        }
        setLoading(true);
        try {
            const userDocRef = doc(db, 'users', currentUser.uid);
            await updateDoc(userDocRef, { name: profileName.trim() });
            // إذا كان الاسم في Firebase Auth مختلفاً، يمكن تحديثه أيضاً
            if (currentUser.displayName !== profileName.trim()) {
                await currentUser.updateProfile({ displayName: profileName.trim() });
            }
            setMessage('تم تحديث الاسم بنجاح!');
            setIsEditingName(false);
        } catch (err) {
            console.error("Error updating profile name:", err);
            setError('فشل تحديث الاسم: ' + err.message);
        } finally {
            setLoading(false);
        }
    }, [profileName, currentUser]);

    // دالة لإعادة تعيين كلمة المرور
    const handlePasswordReset = useCallback(() => {
        if (!currentUser || !currentUser.email) {
            setError('لا يوجد بريد إلكتروني لإعادة تعيين كلمة المرور.');
            return;
        }

        setModalConfig({
            title: "إعادة تعيين كلمة المرور",
            message: `هل أنت متأكد أنك تريد إرسال بريد إلكتروني لإعادة تعيين كلمة المرور إلى ${currentUser.email}؟`,
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                setError('');
                setMessage('');
                try {
                    await sendPasswordResetEmail(firebaseAuth, currentUser.email);
                    setMessage('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد والبريد المزعج.');
                } catch (err) {
                    console.error("Password reset error:", err);
                    setError('فشل في إرسال رابط إعادة تعيين كلمة المرور: ' + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, [currentUser, firebaseAuth]);


    if (loading) {
        return <p className="loading-message">جاري تحميل الملف الشخصي...</p>;
    }

    if (!currentUser) {
        return <p className="info-message">يرجى تسجيل الدخول لعرض ملفك الشخصي.</p>;
    }

    return (
        <div className="user-profile-container page-container">
            <h2 className="profile-title">ملفي الشخصي</h2>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div className="profile-details card">
                <div className="detail-item">
                    <strong>البريد الإلكتروني:</strong> <span>{currentUser.email}</span>
                </div>
                <div className="detail-item">
                    <strong>الصلاحية:</strong> <span>{userRole}</span>
                </div>
                <div className="detail-item">
                    <strong>الاسم:</strong>
                    {isEditingName ? (
                        <div className="edit-name-section">
                            <input
                                type="text"
                                value={profileName}
                                onChange={(e) => setProfileName(e.target.value)}
                                className="edit-input"
                                disabled={loading}
                            />
                            <button onClick={handleUpdateProfileName} className="save-button" disabled={loading}>حفظ</button>
                            <button onClick={() => { setIsEditingName(false); setProfileName(profileName); setError(''); setMessage(''); }} className="cancel-button" disabled={loading}>إلغاء</button>
                        </div>
                    ) : (
                        <>
                            <span>{profileName || 'غير محدد'}</span>
                            <button onClick={() => setIsEditingName(true)} className="edit-button" disabled={loading}>تعديل الاسم</button>
                        </>
                    )}
                </div>

                {userRole === 'teacher' && associatedHalaqat.length > 0 && (
                    <div className="detail-item">
                        <strong>الحلقات المرتبطة:</strong>
                        <span>{associatedHalaqat.join(', ')}</span>
                    </div>
                )}

                {userRole === 'guest' && associatedStudents.length > 0 && (
                    <div className="detail-item">
                        <strong>الطلاب المرتبطون:</strong>
                        <span>{associatedStudents.join(', ')}</span>
                    </div>
                )}
            </div>

            <div className="profile-actions card">
                <button onClick={handlePasswordReset} className="reset-password-button" disabled={loading}>
                    إعادة تعيين كلمة المرور
                </button>
                {/* يمكنك إضافة أزرار أخرى هنا مثل حذف الحساب (يتطلب تأكيدًا قوياً ومنطقًا معقدًا) */}
            </div>

            {/* مودال التأكيد */}
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
