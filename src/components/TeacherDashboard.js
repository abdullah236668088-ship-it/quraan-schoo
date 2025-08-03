import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore";
import CustomModal from './CustomModal';
import '../Styles/TeacherDashboardStyles.css'; // Assuming you have a CSS file for styling

export default function TeacherDashboard() {
    const { currentUser } = useAuth();
    const [halaqat, setHalaqat] = useState([]);
    const [teachers, setTeachers] = useState([]); // Kept for teacherName logic, can be optimized later
    const [newHalaqaName, setNewHalaqaName] = useState("");
    const [editingHalaqaId, setEditingHalaqaId] = useState(null);
    const [editingHalaqaName, setEditingHalaqaName] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    const fetchHalaqatAndTeachers = useCallback(async () => {
        if (!currentUser || !currentUser.uid) {
            setLoading(false);
            return;
        }
        setLoading(true);
        setError("");
        try {
            const [halaqatSnapshot, teachersSnapshot] = await Promise.all([
                getDocs(query(collection(db, "halaqat"), where("teacherId", "==", currentUser.uid))),
                getDocs(collection(db, "teachers")) // Needed to get teacher's own name
            ]);

            const halaqatList = halaqatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setHalaqat(halaqatList);

            const teachersList = teachersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setTeachers(teachersList);

        } catch (err) {
            console.error("Error fetching data:", err);
            setError("فشل في جلب البيانات: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [currentUser]);

    useEffect(() => {
        fetchHalaqatAndTeachers();
    }, [fetchHalaqatAndTeachers]);

    const handleAddHalaqa = useCallback(async () => {
        setError("");
        setMessage("");
        if (!newHalaqaName.trim()) {
            setError("يرجى إدخال اسم الحلقة.");
            return;
        }

        setLoading(true);
        try {
            const teacherInfo = teachers.find(t => t.id === currentUser.uid);
            const halaqaData = {
                name: newHalaqaName,
                teacherId: currentUser.uid,
                teacherName: teacherInfo?.name || "غير معروف"
            };
            await addDoc(collection(db, "halaqat"), halaqaData);
            setNewHalaqaName("");
            setMessage("تم إضافة الحلقة بنجاح!");
            await fetchHalaqatAndTeachers();
        } catch (err) {
            console.error("Error adding halaqa:", err);
            setError("فشل في إضافة الحلقة: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [newHalaqaName, currentUser, teachers, fetchHalaqatAndTeachers]);

    const handleEditClick = useCallback((halaqa) => {
        setEditingHalaqaId(halaqa.id);
        setEditingHalaqaName(halaqa.name);
        setError("");
        setMessage("");
    }, []);

    const handleUpdateHalaqa = useCallback(async (halaqaId) => {
        setError("");
        setMessage("");
        if (!editingHalaqaName.trim()) {
            setError("يرجى إدخال اسم الحلقة.");
            return;
        }

        setLoading(true);
        try {
            const halaqaDocRef = doc(db, "halaqat", halaqaId);
            const teacherInfo = teachers.find(t => t.id === currentUser.uid);
            const updatedData = {
                name: editingHalaqaName,
                teacherId: currentUser.uid,
                teacherName: teacherInfo?.name || "غير معروف"
            };
            await updateDoc(halaqaDocRef, updatedData);
            setEditingHalaqaId(null);
            setEditingHalaqaName("");
            setMessage("تم تحديث الحلقة بنجاح!");
            await fetchHalaqatAndTeachers();
        } catch (err) {
            console.error("Error updating halaqa:", err);
            setError("فشل في تحديث الحلقة: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [editingHalaqaName, currentUser, teachers, fetchHalaqatAndTeachers]);

    const handleDeleteHalaqa = useCallback((id) => {
        setModalConfig({
            title: "تأكيد الحذف",
            message: "هل أنت متأكد أنك تريد حذف هذه الحلقة؟ سيتم حذف جميع الطلاب المرتبطين بها تلقائيًا من قبل الخادم.",
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                setError("");
                setMessage("");
                try {
                    // Simply delete the halaqa document. The Cloud Function will handle the rest.
                    // فقط قم بحذف مستند الحلقة. الدالة السحابية ستتكفل بالباقي.
                    await deleteDoc(doc(db, "halaqat", id));
                    setMessage("تم حذف الحلقة بنجاح! سيتم حذف الطلاب المرتبطين بها في الخلفية.");
                    await fetchHalaqatAndTeachers();
                } catch (err) {
                    console.error("Error deleting halaqa:", err);
                    setError("فشل في حذف الحلقة: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, [fetchHalaqatAndTeachers]);

    return (
        <div className="dashboard-container page-container">
            <h2 className="dashboard-title">لوحة تحكم المعلم</h2>
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div className="halaqat-list-section card">
                <h3>الحلقات الخاصة بي</h3>
                {loading ? <p className="loading-message">جاري تحميل الحلقات...</p> :
                    halaqat.length === 0 ? <p className="no-data-message">لا توجد حلقات مرتبطة بك بعد.</p> :
                        <ul className="halaqat-list">
                            {halaqat.map((halaqa) => (
                                <li key={halaqa.id} className="halaqa-item">
                                    {editingHalaqaId === halaqa.id ? (
                                        <div className="edit-halaqa-form">
                                            <input type="text" value={editingHalaqaName} onChange={(e) => setEditingHalaqaName(e.target.value)} className="edit-halaqa-input" />
                                            <button onClick={() => handleUpdateHalaqa(halaqa.id)} className="save-button" disabled={loading}>حفظ</button>
                                            <button onClick={() => setEditingHalaqaId(null)} className="cancel-button" disabled={loading}>إلغاء</button>
                                        </div>
                                    ) : (
                                        <div className="halaqa-details">
                                            <span>{halaqa.name}</span>
                                            <div className="halaqa-actions">
                                                <button onClick={() => handleEditClick(halaqa)} className="edit-button">تعديل</button>
                                                <button onClick={() => handleDeleteHalaqa(halaqa.id)} className="delete-button">حذف</button>
                                            </div>
                                        </div>
                                    )}
                                </li>
                            ))}
                        </ul>
                }
            </div>

            <div className="add-halaqa-section card">
                <h3>إضافة حلقة جديدة</h3>
                <input type="text" placeholder="اسم الحلقة الجديدة" value={newHalaqaName} onChange={(e) => setNewHalaqaName(e.target.value)} className="new-halaqa-input" />
                <button onClick={handleAddHalaqa} className="add-halaqa-button" disabled={loading}>
                    {loading ? "جاري الإضافة..." : "إضافة حلقة"}
                </button>
            </div>

            <CustomModal isOpen={showModal} {...modalConfig} />
        </div>
    );
}