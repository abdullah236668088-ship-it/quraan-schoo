import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext"; // استيراد useAuth للتحقق من الدور
import CustomModal from './CustomModal'; // استيراد مكون المودال المخصص
import '../Styles/TeachersStyles.css'; // استيراد ملف التنسيقات الخارجي

export default function Teachers() {
    const { userRole } = useAuth(); // جلب دور المستخدم
    const [teachers, setTeachers] = useState([]);
    const [newTeacherName, setNewTeacherName] = useState("");
    const [editingTeacherId, setEditingTeacherId] = useState(null);
    const [editingTeacherName, setEditingTeacherName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState(""); // رسائل النجاح

    // حالات المودال
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    useEffect(() => {
        // التحقق من صلاحيات المستخدم: فقط المدير يمكنه الوصول لهذه الصفحة
        if (userRole !== "admin") {
            setLoading(false);
            setError("ليس لديك الصلاحية للوصول إلى هذه الصفحة.");
            return;
        }

        setLoading(true);
        setError("");
        const teachersCollectionRef = collection(db, "users"); // المعلمون هم نوع من المستخدمين

        // استخدام onSnapshot لجلب التحديثات في الوقت الفعلي
        // فلترة المستخدمين الذين لديهم دور 'teacher'
        const q = query(teachersCollectionRef, where("role", "==", "teacher"));

        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            const teachersList = [];
            querySnapshot.forEach((doc) => {
                teachersList.push({ id: doc.id, ...doc.data() });
            });
            setTeachers(teachersList);
            setLoading(false);
        }, (err) => {
            console.error("Error fetching teachers in real-time:", err);
            setError("فشل في جلب بيانات المعلمين في الوقت الفعلي: " + err.message);
            setLoading(false);
        });

        // دالة التنظيف لإلغاء الاشتراك عند إلغاء تحميل المكون
        return () => unsubscribe();
    }, [userRole]); // اعتمادية على userRole

    const handleAddTeacher = useCallback(async () => {
        setError("");
        setMessage("");
        if (!newTeacherName.trim()) {
            setError("يرجى إدخال اسم المعلم.");
            return;
        }

        setLoading(true);
        try {
            // التحقق من أن اسم المعلم غير مكرر في Firestore
            const q = query(collection(db, "users"), where("name", "==", newTeacherName.trim()), where("role", "==", "teacher"));
            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setError("هذا المعلم موجود بالفعل.");
                setLoading(false);
                return;
            }

            // إضافة معلم جديد (كمستخدم بدوره 'teacher')
            // ملاحظة: لا يمكن إضافة مستخدمين جدد إلى Firebase Auth مباشرة من هنا.
            // يجب أن يكون المستخدم قد تم تسجيله مسبقًا (مثلاً من صفحة التسجيل) ثم يتم تغيير دوره.
            // أو يمكن ربط عملية إضافة المعلم بعملية إنشاء حساب جديد له.
            // في هذا السياق، نفترض أننا نضيف وثيقة في Firestore فقط.
            // إذا كنت تريد إنشاء حساب مصادقة هنا، سيتطلب ذلك منطقًا إضافيًا لإنشاء المستخدم في Firebase Auth.
            await addDoc(collection(db, "users"), {
                name: newTeacherName.trim(),
                role: "teacher",
                createdAt: new Date(), // إضافة تاريخ الإنشاء
                // يمكنك إضافة حقول أخرى مثل email, password (إذا تم إنشاؤها عبر Auth)
            });
            setNewTeacherName("");
            setMessage("تم إضافة المعلم بنجاح! (تأكد من وجود حساب مصادقة لهذا المعلم)");
        } catch (err) {
            console.error("Error adding teacher:", err);
            setError("فشل في إضافة المعلم: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [newTeacherName]);

    const handleEditClick = useCallback((teacher) => {
        setEditingTeacherId(teacher.id);
        setEditingTeacherName(teacher.name);
        setError("");
        setMessage("");
    }, []);

    const handleUpdateTeacher = useCallback(async (teacherId) => {
        setError("");
        setMessage("");
        if (!editingTeacherName.trim()) {
            setError("يرجى إدخال اسم المعلم.");
            return;
        }

        setLoading(true);
        try {
            // التحقق من أن الاسم الجديد ليس مكررًا (باستثناء المعلم نفسه الذي يتم تعديله)
            const q = query(collection(db, "users"), where("name", "==", editingTeacherName.trim()), where("role", "==", "teacher"));
            const snapshot = await getDocs(q);
            const isDuplicate = snapshot.docs.some(doc => doc.id !== teacherId);

            if (isDuplicate) {
                setError("هذا المعلم موجود بالفعل.");
                setLoading(false);
                return;
            }

            const teacherDocRef = doc(db, "users", teacherId); // تحديث وثيقة المستخدم (المعلم)
            await updateDoc(teacherDocRef, { name: editingTeacherName.trim() });

            setMessage("تم تحديث المعلم بنجاح!");
            setEditingTeacherId(null);
            setEditingTeacherName("");
        } catch (err) {
            console.error("Error updating teacher:", err);
            setError("فشل في تحديث المعلم: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [editingTeacherName]);

    const handleDeleteTeacher = useCallback((id) => {
        setModalConfig({
            title: "تأكيد الحذف",
            message: "هل أنت متأكد أنك تريد حذف هذا المعلم؟ سيتم إلغاء ربط جميع الحلقات المرتبطة به. (لا يؤثر هذا على حساب المصادقة الخاص به في Firebase Auth).",
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                setError("");
                setMessage("");
                try {
                    // 1. تحديث الحلقات لإزالة teacherId
                    const halaqatQuery = query(collection(db, "halaqat"), where("teacherId", "==", id));
                    const halaqatSnapshot = await getDocs(halaqatQuery);
                    const updateHalaqatPromises = halaqatSnapshot.docs.map(halaqaDoc =>
                        updateDoc(doc(db, "halaqat", halaqaDoc.id), { teacherId: null, teacherName: null })
                    );
                    await Promise.all(updateHalaqatPromises);

                    // 2. تحديث الطلاب لإزالة teacherId (إذا كان موجودًا في وثائق الطلاب)
                    // ملاحظة: في معظم التصميمات، الطالب يرتبط بالحلقة، والحلقة ترتبط بالمعلم.
                    // إذا كان الطالب لا يحتوي على teacherId مباشر، يمكن حذف هذا الجزء.
                    // ولكن إذا كان موجودًا، فمن الجيد تحديثه.
                    const studentsQuery = query(collection(db, "students"), where("teacherId", "==", id));
                    const studentsSnapshot = await getDocs(studentsQuery);
                    const updateStudentsPromises = studentsSnapshot.docs.map(studentDoc =>
                        updateDoc(doc(db, "students", studentDoc.id), { teacherId: null })
                    );
                    await Promise.all(updateStudentsPromises);

                    // 3. حذف وثيقة المعلم من مجموعة 'users'
                    await deleteDoc(doc(db, "users", id)); // حذف وثيقة المستخدم (المعلم)

                    setMessage("تم حذف المعلم وتحديث الحلقات والطلاب المرتبطين بنجاح!");
                } catch (err) {
                    console.error("Error deleting teacher or updating associated data:", err);
                    setError("فشل في حذف المعلم: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, []);

    // عرض رسالة عدم الصلاحية إذا لم يكن الدور "أدمن"
    if (userRole !== "admin") {
        return <div className="unauthorized-message">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</div>;
    }

    if (loading) {
        return <p className="loading-message">جاري تحميل بيانات المعلمين...</p>;
    }

    return (
        <div className="teachers-container page-container">
            <h2 className="teachers-title">إدارة المعلمين</h2>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div className="teachers-list-section card">
                <h3>المعلمون الحاليون</h3>
                {teachers.length === 0 ? (
                    <p className="no-data-message">لا يوجد معلمون مسجلون حاليًا.</p>
                ) : (
                    <ul className="teachers-list">
                        {teachers.map((teacher) => (
                            <li key={teacher.id} className="teacher-item">
                                {editingTeacherId === teacher.id ? (
                                    <div className="edit-teacher-form">
                                        <input
                                            type="text"
                                            value={editingTeacherName}
                                            onChange={(e) => setEditingTeacherName(e.target.value)}
                                            className="edit-teacher-input"
                                            required
                                        />
                                        <button onClick={() => handleUpdateTeacher(teacher.id)} className="save-button" disabled={loading}>
                                            {loading ? "جاري الحفظ..." : "حفظ"}
                                        </button>
                                        <button onClick={() => { setEditingTeacherId(null); setError(""); setMessage(""); }} className="cancel-button" disabled={loading}>
                                            إلغاء
                                        </button>
                                    </div>
                                ) : (
                                    <div className="teacher-details">
                                        <strong>{teacher.name}</strong>
                                        <div className="teacher-actions">
                                            <button onClick={() => handleEditClick(teacher)} className="edit-button">
                                                تعديل
                                            </button>
                                            <button onClick={() => handleDeleteTeacher(teacher.id)} className="delete-button">
                                                حذف
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div className="add-teacher-section card">
                <h3>إضافة معلم جديد</h3>
                <input
                    type="text"
                    placeholder="اسم المعلم الجديد"
                    value={newTeacherName}
                    onChange={(e) => setNewTeacherName(e.target.value)}
                    className="new-teacher-input"
                    required
                />
                <button onClick={handleAddTeacher} className="add-teacher-button" disabled={loading}>
                    {loading ? "جاري الإضافة..." : "إضافة معلم جديد"}
                </button>
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
