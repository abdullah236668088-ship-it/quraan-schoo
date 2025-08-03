import React, { useEffect, useState, useCallback } from "react";
import { db, auth } from "../firebaseConfig";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    query,
    where,
    onSnapshot, // إضافة onSnapshot
} from "firebase/firestore";
import { createUserWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth"; // إضافة sendPasswordResetEmail
import { useAuth } from "../contexts/AuthContext"; // استيراد useAuth
import CustomModal from './CustomModal'; // استيراد مكون المودال المخصص
import '../Styles/UserManagementStyles.css'; // استيراد ملف التنسيقات الخارجي

export default function UserManagement() {
    const { getAllUsers, updateUserRole, currentUser, userRole } = useAuth(); // جلب الوظائف وحالة المستخدم
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [formMode, setFormMode] = useState("add"); // 'add' or 'edit'
    const [formData, setFormData] = useState({
        id: "",
        email: "",
        password: "", // فقط للإضافة
        name: "",
        role: "guest",
        associatedHalaqat: [], // for teachers
        associatedStudents: [], // for guests
        isBlocked: false, // حقل جديد للحظر
    });
    const [halaqatList, setHalaqatList] = useState([]);
    const [studentsList, setStudentsList] = useState([]);
    const [message, setMessage] = useState("");
    const [activeTab, setActiveTab] = useState('manageUsers'); // حالة لتبديل بين إدارة المستخدمين وإضافة مستخدم

    // حالات المودال
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // جلب الحلقات والطلاب (لربطهم بالمستخدمين)
    const fetchAssociatedData = useCallback(async () => {
        try {
            const [halaqatSnapshot, studentsSnapshot] = await Promise.all([
                getDocs(collection(db, "halaqat")),
                getDocs(collection(db, "students"))
            ]);
            setHalaqatList(halaqatSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
            setStudentsList(studentsSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
        } catch (err) {
            console.error("Error fetching associated data:", err);
            setError("فشل في جلب بيانات الحلقات والطلاب: " + err.message);
        }
    }, []);

    useEffect(() => {
        if (userRole !== 'admin') {
            setLoading(false);
            setError('ليس لديك الصلاحية للوصول إلى هذه الصفحة.');
            return;
        }

        setLoading(true);
        setError('');

        // جلب البيانات المرتبطة مرة واحدة
        fetchAssociatedData();

        // استخدام onSnapshot لجلب المستخدمين في الوقت الفعلي
        const usersCollectionRef = collection(db, "users");
        const unsubscribe = onSnapshot(usersCollectionRef, (snapshot) => {
            const fetchedUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            // تصفية المستخدم الحالي من القائمة إذا كان مديراً
            setUsers(fetchedUsers.filter(user => user.id !== currentUser.uid));
            setLoading(false);
        }, (err) => {
            console.error("Error fetching users in real-time:", err);
            setError('فشل جلب المستخدمين: ' + err.message);
            setLoading(false);
        });

        return () => unsubscribe(); // إلغاء الاشتراك عند إلغاء تحميل المكون
    }, [userRole, currentUser, fetchAssociatedData]);


    const handleInputChange = useCallback((e) => {
        const { name, value, options } = e.target;
        if (name === "associatedHalaqat" || name === "associatedStudents") {
            // التعامل مع تحديدات متعددة لـ select
            const selectedValues = Array.from(options)
                .filter(option => option.selected)
                .map(option => option.value);
            setFormData(prev => ({ ...prev, [name]: selectedValues }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    }, []);

    const resetForm = useCallback(() => {
        setFormMode("add");
        setFormData({
            id: "",
            email: "",
            password: "",
            name: "",
            role: "guest",
            associatedHalaqat: [],
            associatedStudents: [],
            isBlocked: false,
        });
        setError("");
        setMessage("");
    }, []);

    const handleAddUser = useCallback(async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        if (!formData.email || !formData.password || !formData.name || !formData.role) {
            setError("الرجاء ملء جميع الحقول المطلوبة.");
            setLoading(false);
            return;
        }
        if (formData.password.length < 6) {
            setError("كلمة المرور يجب أن تكون 6 أحرف على الأقل.");
            setLoading(false);
            return;
        }

        try {
            // إنشاء المستخدم في Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
            const newUserUid = userCredential.user.uid;

            // حفظ بيانات المستخدم في Firestore
            const userData = {
                name: formData.name,
                email: formData.email,
                role: formData.role,
                createdAt: new Date(),
                isBlocked: false, // افتراضياً غير محظور عند الإنشاء
            };

            if (formData.role === "teacher") {
                userData.associatedHalaqat = formData.associatedHalaqat;
            } else if (formData.role === "guest") {
                userData.associatedStudents = formData.associatedStudents;
            }

            await setDoc(doc(db, "users", newUserUid), userData);
            setMessage("تم إضافة المستخدم بنجاح!");
            resetForm();
            setActiveTab('manageUsers'); // العودة إلى تبويب الإدارة
        } catch (err) {
            console.error("Error adding user:", err);
            if (err.code === 'auth/email-already-in-use') {
                setError('هذا البريد الإلكتروني مستخدم بالفعل.');
            } else {
                setError('فشل في إضافة المستخدم: ' + err.message);
            }
        } finally {
            setLoading(false);
        }
    }, [formData, resetForm]);

    const handleEditClick = useCallback((user) => {
        setFormMode("edit");
        setFormData({
            id: user.id,
            email: user.email,
            password: "", // لا تعرض كلمة المرور الحالية للتعديل
            name: user.name,
            role: user.role,
            associatedHalaqat: user.associatedHalaqat || [],
            associatedStudents: user.associatedStudents || [],
            isBlocked: user.isBlocked || false,
        });
        setActiveTab('addUser'); // الانتقال إلى تبويب إضافة/تعديل المستخدم
        window.scrollTo({ top: 0, behavior: 'smooth' }); // التمرير لأعلى النموذج
    }, []);

    const handleUpdateUser = useCallback(async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        setLoading(true);

        if (!formData.name || !formData.role) {
            setError("الرجاء ملء جميع الحقول المطلوبة.");
            setLoading(false);
            return;
        }

        try {
            const userDocRef = doc(db, "users", formData.id);
            const updatedData = {
                name: formData.name,
                role: formData.role,
                isBlocked: formData.isBlocked,
            };

            // تحديث الروابط بناءً على الدور الجديد
            if (formData.role === "teacher") {
                updatedData.associatedHalaqat = formData.associatedHalaqat;
                updatedData.associatedStudents = []; // مسح روابط الطلاب إذا لم يعد ضيفاً
            } else if (formData.role === "guest") {
                updatedData.associatedStudents = formData.associatedStudents;
                updatedData.associatedHalaqat = []; // مسح روابط الحلقات إذا لم يعد معلماً
            } else { // admin
                updatedData.associatedHalaqat = [];
                updatedData.associatedStudents = [];
            }

            await updateDoc(userDocRef, updatedData);
            setMessage("تم تحديث المستخدم بنجاح!");
            resetForm();
            setActiveTab('manageUsers'); // العودة إلى تبويب الإدارة
        } catch (err) {
            console.error("Error updating user:", err);
            setError("فشل في تحديث المستخدم: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [formData, resetForm]);

    // دالة لتغيير صلاحية المستخدم (من جدول المستخدمين)
    const handleRoleChange = useCallback(async (userId, newRole) => {
        setError("");
        setMessage("");
        setLoading(true);
        try {
            // جلب المستخدم لتحديث الحقول المرتبطة بشكل صحيح
            // ملاحظة: استخدام getDocs مع query(where(doc.id, "==", userId)) ليس الأمثل لجلب وثيقة واحدة بمعرفها.
            // الأفضل هو استخدام doc(db, "users", userId) ثم getDoc(userDocRef).
            const userDocRef = doc(db, "users", userId);
            const userDocSnap = await getDoc(userDocRef); // استخدام getDoc مباشرة

            if (!userDocSnap.exists()) {
                setError("المستخدم غير موجود.");
                setLoading(false);
                return;
            }
            const userData = userDocSnap.data();

            const updatedData = {
                role: newRole,
            };

            // مسح الروابط القديمة وإضافة الجديدة بناءً على الدور الجديد
            if (newRole === "teacher") {
                updatedData.associatedStudents = [];
            } else if (newRole === "guest") {
                updatedData.associatedHalaqat = [];
            } else { // admin
                updatedData.associatedHalaqat = [];
                updatedData.associatedStudents = [];
            }

            await updateDoc(userDocRef, updatedData);
            setMessage(`تم تغيير صلاحية المستخدم ${userData.name || userData.email} إلى ${newRole} بنجاح!`);
        } catch (err) {
            console.error("Error updating user role:", err);
            setError("فشل في تحديث صلاحية المستخدم: " + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    // دالة لإعادة تعيين كلمة مرور المستخدم
    const handlePasswordReset = useCallback((email) => {
        setModalConfig({
            title: "إعادة تعيين كلمة المرور",
            message: `هل أنت متأكد أنك تريد إرسال بريد إلكتروني لإعادة تعيين كلمة المرور إلى ${email}؟`,
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                setError("");
                setMessage("");
                try {
                    await sendPasswordResetEmail(auth, email);
                    setMessage(`تم إرسال رابط إعادة تعيين كلمة المرور إلى ${email} بنجاح.`);
                } catch (err) {
                    console.error("Error sending password reset email:", err);
                    setError("فشل في إرسال رابط إعادة تعيين كلمة المرور: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, []);

    // دالة لتغيير حالة الحظر للمستخدم
    const toggleUserBlockStatus = useCallback((user) => {
        setModalConfig({
            title: user.isBlocked ? "إلغاء حظر المستخدم" : "حظر المستخدم",
            message: `هل أنت متأكد أنك تريد ${user.isBlocked ? "إلغاء حظر" : "حظر"} المستخدم ${user.name || user.email}؟`,
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                setError("");
                setMessage("");
                try {
                    const userDocRef = doc(db, "users", user.id);
                    await updateDoc(userDocRef, { isBlocked: !user.isBlocked });
                    setMessage(`تم ${user.isBlocked ? "إلغاء حظر" : "حظر"} المستخدم ${user.name || user.email} بنجاح.`);
                } catch (err) {
                    console.error("Error toggling block status:", err);
                    setError("فشل في تحديث حالة الحظر: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, []);

    // دالة لحذف المستخدم
    const handleDeleteUser = useCallback((user) => {
        setModalConfig({
            title: "حذف المستخدم",
            message: `هل أنت متأكد أنك تريد حذف المستخدم ${user.name || user.email}؟ هذا الإجراء لا يمكن التراجع عنه. (ملاحظة: هذا سيحذف بيانات المستخدم من قاعدة البيانات، ولكن حذف الحساب من Firebase Authentication يتطلب صلاحيات إدارية على الخادم).`,
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                setError("");
                setMessage("");
                try {
                    // حذف مستند المستخدم من Firestore
                    await deleteDoc(doc(db, "users", user.id));

                    // ملاحظة: حذف المستخدم من Firebase Authentication يجب أن يتم عبر Firebase Admin SDK
                    // مثال (ليس جزءًا من هذا الكود، يتطلب Cloud Function):
                    // await admin.auth().deleteUser(user.id);

                    setMessage(`تم حذف بيانات المستخدم ${user.name || user.email} من قاعدة البيانات بنجاح.`);
                } catch (err) {
                    console.error("Error deleting user:", err);
                    setError("فشل في حذف المستخدم: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, []);


    if (userRole !== 'admin') {
        return <p className="unauthorized-message">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</p>;
    }

    if (loading) {
        return <p className="loading-message">جاري تحميل بيانات المستخدمين...</p>;
    }

    return (
        <div className="user-management-container page-container">
            <h2 className="user-management-title">إدارة المستخدمين</h2>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div className="tabs">
                <button
                    className={`tab-button ${activeTab === 'manageUsers' ? 'active' : ''}`}
                    onClick={() => setActiveTab('manageUsers')}
                >
                    إدارة المستخدمين
                </button>
                <button
                    className={`tab-button ${activeTab === 'addUser' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('addUser'); resetForm(); }}
                >
                    إضافة مستخدم جديد
                </button>
            </div>

            {activeTab === 'manageUsers' && (
                <div className="users-list-section card">
                    <h3>المستخدمون المسجلون</h3>
                    {users.length === 0 ? (
                        <p className="no-data-message">لا يوجد مستخدمون لعرضهم.</p>
                    ) : (
                        <div className="users-table-container">
                            <table className="users-table">
                                <thead>
                                    <tr>
                                        <th>الاسم</th>
                                        <th>البريد الإلكتروني</th>
                                        <th>الصلاحية</th>
                                        <th>معرف المستخدم (UID)</th>
                                        <th>الحالة</th>
                                        <th>الإجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id}>
                                            <td>{user.name || 'غير متوفر'}</td>
                                            <td>{user.email || 'غير متوفر'}</td>
                                            <td>
                                                <select
                                                    value={user.role}
                                                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                                                    className="role-select"
                                                    disabled={loading}
                                                >
                                                    <option value="guest">زائر</option>
                                                    <option value="teacher">معلم</option>
                                                    <option value="admin">مدير</option>
                                                </select>
                                            </td>
                                            <td>{user.id}</td>
                                            <td>
                                                <span className={`status-badge ${user.isBlocked ? 'blocked' : 'active'}`}>
                                                    {user.isBlocked ? 'محظور' : 'نشط'}
                                                </span>
                                            </td>
                                            <td className="actions-cell">
                                                <button
                                                    onClick={() => handleEditClick(user)}
                                                    className="edit-button"
                                                    disabled={loading}
                                                >
                                                    تعديل
                                                </button>
                                                <button
                                                    onClick={() => handlePasswordReset(user.email)}
                                                    className="reset-password-button"
                                                    disabled={loading}
                                                >
                                                    إعادة تعيين كلمة المرور
                                                </button>
                                                <button
                                                    onClick={() => toggleUserBlockStatus(user)}
                                                    className={`toggle-block-button ${user.isBlocked ? 'unblock' : 'block'}`}
                                                    disabled={loading}
                                                >
                                                    {user.isBlocked ? 'إلغاء الحظر' : 'حظر'}
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteUser(user)}
                                                    className="delete-button"
                                                    disabled={loading}
                                                >
                                                    حذف
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'addUser' && (
                <div className="add-user-section card">
                    <h3>{formMode === "add" ? "إضافة مستخدم جديد" : "تعديل مستخدم"}</h3>
                    <form onSubmit={formMode === "add" ? handleAddUser : handleUpdateUser} className="user-form">
                        <div className="form-grid">
                            <div className="form-group">
                                <label>البريد الإلكتروني:</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    required
                                    disabled={formMode === "edit"} // البريد الإلكتروني لا يمكن تعديله
                                />
                            </div>
                            {formMode === "add" && (
                                <div className="form-group">
                                    <label>كلمة المرور:</label>
                                    <input
                                        type="password"
                                        name="password"
                                        value={formData.password}
                                        onChange={handleInputChange}
                                        className="form-input"
                                        required
                                    />
                                </div>
                            )}
                            <div className="form-group">
                                <label>الاسم:</label>
                                <input
                                    type="text"
                                    name="name"
                                    value={formData.name}
                                    onChange={handleInputChange}
                                    className="form-input"
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>الصلاحية:</label>
                                <select
                                    name="role"
                                    value={formData.role}
                                    onChange={handleInputChange}
                                    className="form-select"
                                    required
                                >
                                    <option value="guest">زائر</option>
                                    <option value="teacher">معلم</option>
                                    <option value="admin">مدير</option>
                                </select>
                            </div>

                            {formData.role === "teacher" && (
                                <div className="form-group full-width">
                                    <label>الحلقات المرتبطة (للمعلمين):</label>
                                    <select
                                        name="associatedHalaqat"
                                        multiple
                                        value={formData.associatedHalaqat}
                                        onChange={handleInputChange}
                                        size={halaqatList.length > 5 ? 5 : halaqatList.length || 1}
                                    >
                                        {halaqatList.map((halaqa) => (
                                            <option key={halaqa.id} value={halaqa.id}>
                                                {halaqa.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {formData.role === "guest" && (
                                <div className="form-group full-width">
                                    <label>الطلاب المرتبطون (لأولياء الأمور/الضيوف):</label>
                                    <select
                                        name="associatedStudents"
                                        multiple
                                        value={formData.associatedStudents}
                                        onChange={handleInputChange}
                                        size={studentsList.length > 5 ? 5 : studentsList.length || 1}
                                    >
                                        {studentsList.map((student) => (
                                            <option key={student.id} value={student.id}>
                                                {student.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            {formMode === "edit" && (
                                <div className="form-group">
                                    <label>حالة الحظر:</label>
                                    <input
                                        type="checkbox"
                                        name="isBlocked"
                                        checked={formData.isBlocked}
                                        onChange={(e) => setFormData(prev => ({ ...prev, isBlocked: e.target.checked }))}
                                        className="form-checkbox"
                                    />
                                    <span className="checkbox-label">{formData.isBlocked ? 'محظور' : 'نشط'}</span>
                                </div>
                            )}
                        </div>
                        <div className="form-actions">
                            <button type="submit" className="submit-button" disabled={loading}>
                                {loading ? (formMode === "add" ? "جاري الإضافة..." : "جاري التحديث...") : (formMode === "add" ? "إضافة" : "تحديث")}
                            </button>
                            {formMode === "edit" && (
                                <button type="button" onClick={resetForm} className="cancel-button" disabled={loading}>
                                    إلغاء
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            )}

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
