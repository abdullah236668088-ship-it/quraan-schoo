// src/contexts/AuthContext.js

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    signOut,
    createUserWithEmailAndPassword,
    sendPasswordResetEmail // إضافة sendPasswordResetEmail
} from 'firebase/auth';
import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    collection,
    query,
    getDocs
} from 'firebase/firestore';

import { auth, db } from '../firebaseConfig';

const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState('guest'); // الدور الافتراضي للمستخدم
    const [loading, setLoading] = useState(true); // حالة التحميل الأولية للمصادقة
    const [isAuthReady, setIsAuthReady] = useState(false); // هل حالة المصادقة جاهزة للاستخدام

    useEffect(() => {
        // الاستماع لتغييرات حالة المصادقة
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);
            if (user) {
                // جلب دور المستخدم من Firestore
                const userDocRef = doc(db, 'users', user.uid);
                try {
                    const userDoc = await getDoc(userDocRef);
                    if (userDoc.exists()) {
                        setUserRole(userDoc.data().role);
                    } else {
                        // إذا لم يتم العثور على وثيقة المستخدم (على سبيل المثال، مستخدم مجهول جديد)
                        // قم بإنشاء وثيقة 'guest' افتراضية له.
                        console.warn("User document not found for UID:", user.uid, "Creating default 'guest' role.");
                        await setDoc(userDocRef, { role: 'guest', email: user.email || null, createdAt: new Date() }, { merge: true });
                        setUserRole('guest');
                    }
                } catch (error) {
                    console.error("Error fetching user role from Firestore:", error);
                    setUserRole('guest'); // العودة إلى دور الضيف عند الخطأ
                }
            } else {
                setUserRole('guest'); // لا يوجد مستخدم، الدور الافتراضي هو ضيف
            }
            setLoading(false);
            setIsAuthReady(true); // حالة المصادقة جاهزة الآن
        });

        return unsubscribe; // تنظيف المستمع عند إلغاء تحميل المكون
    }, []); // مصفوفة الاعتمادية فارغة تعني أن هذا يتم تشغيله مرة واحدة عند التحميل

    // تسجيل مستخدم جديد بالبريد الإلكتروني وكلمة المرور، وتعيين دور افتراضي في Firestore
    const register = async (email, password, name) => { // إضافة name كمعامل
        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;
            // إنشاء وثيقة مستخدم في Firestore بدور 'guest' افتراضي
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                name: name, // حفظ الاسم
                role: 'guest', // التأكد من أن هذا يتطابق مع قواعد Firestore الخاصة بك
                createdAt: new Date()
            });
            return user;
        } catch (error) {
            console.error("Error registering user:", error);
            throw error; // أعد طرحه ليتم التقاطه بواسطة المكون الذي يستدعي
        }
    };

    // تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
    const login = async (email, password) => {
        try {
            return await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Error logging in:", error);
            throw error; // أعد طرحه ليتم التقاطه بواسطة المكون الذي يستدعي
        }
    };

    // تسجيل خروج المستخدم الحالي
    const logout = async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Error logging out:", error);
            throw error;
        }
    };

    // دالة لإرسال بريد إلكتروني لإعادة تعيين كلمة المرور
    const resetPassword = async (email) => {
        try {
            await sendPasswordResetEmail(auth, email);
            console.log(`Password reset email sent to ${email}`);
        } catch (error) {
            console.error("Error sending password reset email:", error);
            throw error;
        }
    };

    // دالة لتحديث دور المستخدم (يمكن الوصول إليها بواسطة المسؤول)
    const updateUserRole = async (userId, newRole) => {
        try {
            const userDocRef = doc(db, 'users', userId);
            await updateDoc(userDocRef, { role: newRole });
            // إذا تم تحديث دور المستخدم الحالي، قم بتحديثه
            if (currentUser && currentUser.uid === userId) {
                setUserRole(newRole);
            }
            console.log(`User ${userId} role updated to ${newRole}`);
        } catch (error) {
            console.error("Error updating user role:", error);
            throw error;
        }
    };

    // دالة لجلب جميع المستخدمين (للوحة تحكم المسؤول)
    const getAllUsers = async () => {
        try {
            const usersCollectionRef = collection(db, 'users');
            const q = query(usersCollectionRef);
            const querySnapshot = await getDocs(q);
            const usersList = [];
            querySnapshot.forEach((doc) => {
                usersList.push({ id: doc.id, ...doc.data() });
            });
            return usersList;
        } catch (error) {
            console.error("Error getting all users:", error);
            throw error;
        }
    };

    // دالة مساعدة لتحديد مسار لوحة التحكم بناءً على الدور
    const getDashboardPath = useCallback(() => {
        if (userRole === 'admin') {
            return '/admin-dashboard'; // أو '/admin-dashboard' إذا كان لديك مسار محدد
        } else if (userRole === 'teacher') {
            return '/teacher-dashboard'; // أو '/'
        } else {
            return '/'; // الصفحة الرئيسية للضيوف
        }
    }, [userRole]);


    const value = {
        currentUser,
        userRole,
        loading,
        isAuthReady,
        register,
        login,
        logout,
        resetPassword, // إضافة resetPassword إلى السياق
        updateUserRole,
        getAllUsers,
        getDashboardPath // إضافة getDashboardPath إلى السياق
    };

    return (
        <AuthContext.Provider value={value}>
            {/* عرض الأطفال فقط عندما تكون المصادقة جاهزة */}
            {isAuthReady ? children : <div className="auth-loading-screen">جاري تحميل المصادقة...</div>}
        </AuthContext.Provider>
    );
}
