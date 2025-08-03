// src/pages/HalaqatPage.js
import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
    onSnapshot
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import '../Styles/HalaqatPageStyles.css';
import CustomModal from '../components/CustomModal';
import HalaqaItem from '../components/HalaqaItem';
import AddHalaqaForm from '../components/AddHalaqaForm';

export default function HalaqatPage() {
    const { currentUser, userRole, loading: authLoading } = useAuth();
    const [halaqat, setHalaqat] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [newHalaqaName, setNewHalaqaName] = useState("");
    const [selectedTeacherId, setSelectedTeacherId] = useState("");
    const [editingHalaqaId, setEditingHalaqaId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    useEffect(() => {
        if (authLoading || !currentUser) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");

        // 1. Listener for teachers (only for admins)
        let teachersUnsubscribe;
        if (userRole === 'admin') {
            const teachersQuery = query(collection(db, "users"), where("role", "==", "teacher"));
            teachersUnsubscribe = onSnapshot(teachersQuery, (snapshot) => {
                const teachersList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setTeachers(teachersList);
            }, (err) => {
                console.error("Error fetching teachers:", err);
                setError("فشل في جلب المعلمين: " + err.message);
            });
        } else {
            setTeachers([]);
        }

        // 2. Listener for Halaqat based on user role
        let halaqatQueryRef;
        if (userRole === "teacher") {
            halaqatQueryRef = query(collection(db, "halaqat"), where("teacherId", "==", currentUser.uid));
        } else if (userRole === "admin") {
            halaqatQueryRef = collection(db, "halaqat");
        }

        let halaqaUnsubscribe;
        if (halaqatQueryRef) {
            halaqaUnsubscribe = onSnapshot(halaqatQueryRef, (snapshot) => {
                const halaqatList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHalaqat(halaqatList);
                setLoading(false);
            }, (err) => {
                console.error("Error fetching halaqat:", err);
                setError("فشل في جلب الحلقات: " + err.message);
                setLoading(false);
            });
        } else {
            setHalaqat([]);
            setLoading(false);
        }

        // Cleanup function
        return () => {
            if (teachersUnsubscribe) teachersUnsubscribe();
            if (halaqaUnsubscribe) halaqaUnsubscribe();
        };
    }, [currentUser, userRole, authLoading]);

    const handleAddHalaqa = useCallback(async () => {
        setError("");
        setMessage("");
        if (!newHalaqaName.trim()) {
            return setError("يرجى إدخال اسم الحلقة.");
        }
        if (userRole === "admin" && !selectedTeacherId) {
            return setError("يرجى اختيار معلم للحلقة.");
        }

        setLoading(true);
        try {
            const teacherId = userRole === "teacher" ? currentUser.uid : selectedTeacherId;
            const teacher = teachers.find(t => t.id === teacherId);
            
            const halaqaData = {
                name: newHalaqaName,
                teacherId: teacherId,
                teacherName: teacher ? teacher.name : "غير معروف"
            };
            await addDoc(collection(db, "halaqat"), halaqaData);
            setNewHalaqaName("");
            setSelectedTeacherId("");
            setMessage("تم إضافة الحلقة بنجاح!");
        } catch (err) {
            console.error("Error adding halaqa:", err);
            setError("فشل في إضافة الحلقة: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [newHalaqaName, selectedTeacherId, userRole, currentUser, teachers]);

    const handleEditClick = useCallback((halaqa) => {
        setEditingHalaqaId(halaqa.id);
        setError("");
        setMessage("");
    }, []);

    const handleSaveEdit = useCallback(async (id, editedName, editedTeacherId) => {
        setError("");
        setMessage("");
        if (!editedName.trim()) {
            return setError("يرجى إدخال اسم الحلقة.");
        }
        if (userRole === "admin" && !editedTeacherId) {
            return setError("يرجى اختيار معلم للحلقة.");
        }

        setLoading(true);
        try {
            const halaqaDocRef = doc(db, "halaqat", id);
            const teacherId = userRole === "teacher" ? currentUser.uid : editedTeacherId;
            const teacher = teachers.find(t => t.id === teacherId);

            const updatedData = {
                name: editedName,
                teacherId: teacherId,
                teacherName: teacher ? teacher.name : "غير معروف"
            };
            await updateDoc(halaqaDocRef, updatedData);
            setEditingHalaqaId(null);
            setMessage("تم تحديث الحلقة بنجاح!");
        } catch (err) {
            console.error("Error updating halaqa:", err);
            setError("فشل في تحديث الحلقة: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [userRole, currentUser, teachers]);

    const handleCancelEdit = useCallback(() => {
        setEditingHalaqaId(null);
        setError("");
        setMessage("");
    }, []);

    const handleDeleteHalaqa = useCallback((id) => {
        setModalConfig({
            title: "تأكيد الحذف",
            message: "هل أنت متأكد أنك تريد حذف هذه الحلقة؟",
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                try {
                    await deleteDoc(doc(db, "halaqat", id));
                    setMessage("تم حذف الحلقة بنجاح!");
                } catch (err) {
                    console.error("Error deleting halaqa:", err);
                    setError("فشل في حذف الحلقة: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false)
        });
        setShowModal(true);
    }, []); // No dependencies needed, state setters are stable.

    if (userRole !== "admin" && userRole !== "teacher") {
        return <div className="unauthorized-message">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</div>;
    }

    if (authLoading) {
        return <p className="loading-message">جاري المصادقة...</p>;
    }
    
    return (
        <div className="halaqat-page-container page-container">
            <h2 className="halaqat-page-title">إدارة الحلقات</h2>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            { userRole === 'admin' && 
                <AddHalaqaForm
                    newHalaqaName={newHalaqaName}
                    setNewHalaqaName={setNewHalaqaName}
                    selectedTeacherId={selectedTeacherId}
                    setSelectedTeacherId={setSelectedTeacherId}
                    teachers={teachers}
                    loading={loading}
                    onAddHalaqa={handleAddHalaqa}
                />
            }

            <div className="halaqat-list-section card">
                <h3>الحلقات الحالية</h3>
                {loading ? (
                    <p className="loading-message">جاري تحميل الحلقات...</p>
                ) : halaqat.length === 0 ? (
                    <p className="no-data-message">لا توجد حلقات لعرضها.</p>
                ) : (
                    <ul className="halaqat-list">
                        {halaqat.map((halaqa) => (
                            <li key={halaqa.id} className="halaqa-item-wrapper">
                                <HalaqaItem
                                    halaqa={halaqa}
                                    isEditing={editingHalaqaId === halaqa.id}
                                    onEdit={handleEditClick}
                                    onDelete={() => handleDeleteHalaqa(halaqa.id)}
                                    onSave={handleSaveEdit}
                                    onCancel={handleCancelEdit}
                                    teachers={teachers}
                                    userRole={userRole}
                                    loading={loading}
                                />
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <CustomModal
                isOpen={showModal}
                title={modalConfig.title}
                message={modalConfig.message}
                onConfirm={modalConfig.onConfirm}
                onCancel={modalConfig.onCancel}
                showCancelButton={true}
            />
        </div>
    );
}

