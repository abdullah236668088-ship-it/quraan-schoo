import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebaseConfig";
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    deleteDoc,
    doc,
} from "firebase/firestore";
import '../Styles/ActivitiesManagementStyles.css'; // استيراد ملف التنسيقات الخارجي
import CustomModal from './CustomModal'; // استيراد مكون المودال المخصص

export default function ActivitiesManagement() {
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [formData, setFormData] = useState({
        id: "",
        name: "",
        description: "",
        date: "",
        time: "",
        location: "",
        imageUrl: "",
    });
    const [formMode, setFormMode] = useState("add"); // 'add' or 'edit'
    const [message, setMessage] = useState("");

    // حالات المودال
    const [showModal, setShowModal] = useState(false);
    const [modalConfig, setModalConfig] = useState({});

    // دالة لجلب الأنشطة من Firestore
    const fetchActivities = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const snapshot = await getDocs(collection(db, "activities"));
            const activitiesList = [];
            snapshot.forEach((doc) => {
                activitiesList.push({ id: doc.id, ...doc.data() });
            });
            setActivities(activitiesList);
        } catch (err) {
            console.error("Error fetching activities:", err);
            setError("فشل في جلب الأنشطة: " + err.message);
        } finally {
            setLoading(false);
        }
    }, []); // لا توجد تبعيات لأنها تجلب كل الأنشطة

    useEffect(() => {
        fetchActivities();
    }, [fetchActivities]); // إضافة fetchActivities كاعتمادية

    // دالة لمسح النموذج وإعادة تعيينه لوضع الإضافة
    const resetForm = useCallback(() => {
        setFormData({
            id: "",
            name: "",
            description: "",
            date: "",
            time: "",
            location: "",
            imageUrl: "",
        });
        setFormMode("add");
        setError("");
        setMessage("");
    }, []);

    // دالة لتحديث حالة النموذج عند تغيير المدخلات
    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setFormData((prevData) => ({
            ...prevData,
            [name]: value,
        }));
    }, []);

    // دالة للتحقق من صحة البيانات المدخلة
    const validateForm = useCallback(() => {
        const { name, description, date, time, location } = formData;
        if (!name.trim()) {
            setError("اسم النشاط مطلوب.");
            return false;
        }
        if (!description.trim()) {
            setError("وصف النشاط مطلوب.");
            return false;
        }
        if (!date.trim()) {
            setError("تاريخ النشاط مطلوب.");
            return false;
        }
        if (!time.trim()) {
            setError("وقت النشاط مطلوب.");
            return false;
        }
        if (!location.trim()) {
            setError("موقع النشاط مطلوب.");
            return false;
        }
        // يمكنك إضافة المزيد من التحقق هنا، مثل تنسيق التاريخ والوقت
        return true;
    }, [formData]);

    // دالة لإضافة أو تحديث نشاط
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");
        if (!validateForm()) {
            return;
        }

        setLoading(true); // بدء التحميل عند الإرسال
        try {
            const activityData = { ...formData };
            delete activityData.id; // لا نحتاج لمعرف المستند داخل البيانات

            if (formMode === "add") {
                const docRef = await addDoc(collection(db, "activities"), activityData);
                // --- Performance Improvement: Update local state instead of refetching ---
                // تحديث الحالة المحلية مباشرة بدلاً من إعادة جلب كل البيانات
                setActivities(prev => [...prev, { id: docRef.id, ...activityData }]);
                setMessage("تم إضافة النشاط بنجاح!");
            } else {
                const activityDocRef = doc(db, "activities", formData.id);
                await updateDoc(activityDocRef, activityData);
                // --- Performance Improvement: Update local state instead of refetching ---
                // تحديث الحالة المحلية مباشرة بدلاً من إعادة جلب كل البيانات
                setActivities(prev => prev.map(act => act.id === formData.id ? { ...act, ...activityData } : act));
                setMessage("تم تحديث النشاط بنجاح!");
            }
            resetForm(); // مسح النموذج بعد النجاح
            // The line below is no longer needed, improving performance.
            // لم نعد بحاجة إلى هذا السطر، مما يحسن الأداء.
            // await fetchActivities(); 
        } catch (err) {
            console.error("Error saving activity:", err);
            setError("فشل في حفظ النشاط: " + err.message);
        } finally {
            setLoading(false); // إنهاء التحميل
        }
    }, [formMode, formData, validateForm, resetForm, fetchActivities]);

    // دالة لتعبئة النموذج عند النقر على تعديل
    const handleEditClick = useCallback((activity) => {
        setFormData(activity);
        setFormMode("edit");
        setMessage("");
        setError("");
        window.scrollTo({ top: 0, behavior: 'smooth' }); // التمرير لأعلى النموذج
    }, []);

    // دالة لحذف نشاط
    const handleDeleteActivity = useCallback((id) => {
        setModalConfig({
            title: "تأكيد الحذف",
            message: "هل أنت متأكد أنك تريد حذف هذا النشاط؟",
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true); // بدء التحميل عند الحذف
                setError("");
                setMessage("");
                try {
                    await deleteDoc(doc(db, "activities", id));
                    // --- Performance Improvement: Update local state instead of refetching ---
                    setActivities(prev => prev.filter(act => act.id !== id));
                    setMessage("تم حذف النشاط بنجاح!");
                    // The line below is no longer needed, improving performance.
                    // await fetchActivities();
                } catch (err) {
                    console.error("Error deleting activity:", err);
                    setError("فشل في حذف النشاط: " + err.message);
                } finally {
                    setLoading(false); // إنهاء التحميل
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, [fetchActivities]);

    if (loading && activities.length === 0 && !error) {
        return <p className="loading-message">جاري تحميل الأنشطة...</p>;
    }

    return (
        <div className="activities-management-container page-container">
            <h2 className="activities-management-title">إدارة الأنشطة</h2>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <div className="activities-list-section card">
                <h3>الأنشطة الحالية</h3>
                {loading ? (
                    <p className="loading-message">جاري تحميل الأنشطة...</p>
                ) : activities.length === 0 ? (
                    <p className="no-data-message">لا توجد أنشطة حاليًا.</p>
                ) : (
                    <ul className="activities-list">
                        {activities.map((activity) => (
                            <li key={activity.id} className="activity-item">
                                <div className="activity-info">
                                    <h4>{activity.name}</h4>
                                    <p><strong>الوصف:</strong> {activity.description}</p>
                                    <p><strong>التاريخ:</strong> {activity.date}</p>
                                    <p><strong>الوقت:</strong> {activity.time}</p>
                                    <p><strong>الموقع:</strong> {activity.location}</p>
                                    {activity.imageUrl && (
                                        <div className="activity-image-wrapper">
                                            <img src={activity.imageUrl} alt={activity.name} className="activity-image" onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/100x100/CCCCCC/333333?text=No+Image"; }} />
                                        </div>
                                    )}
                                </div>
                                <div className="activity-actions">
                                    <button onClick={() => handleEditClick(activity)} className="edit-button">
                                        تعديل
                                    </button>
                                    <button onClick={() => handleDeleteActivity(activity.id)} className="delete-button">
                                        حذف
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* نموذج إضافة/تعديل النشاط */}
            <div className="activity-form-section card">
                <h3>{formMode === "add" ? "إضافة نشاط جديد" : "تعديل النشاط"}</h3>
                <form onSubmit={handleSubmit} className="activity-form">
                    <div className="form-group">
                        <label>اسم النشاط:</label>
                        <input type="text" name="name" value={formData.name} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>الوصف:</label>
                        <textarea name="description" value={formData.description} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>التاريخ:</label>
                        <input type="date" name="date" value={formData.date} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>الوقت:</label>
                        <input type="time" name="time" value={formData.time} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>الموقع:</label>
                        <input type="text" name="location" value={formData.location} onChange={handleInputChange} required />
                    </div>
                    <div className="form-group">
                        <label>رابط الصورة (اختياري):</label>
                        <input type="url" name="imageUrl" value={formData.imageUrl} onChange={handleInputChange} />
                    </div>
                    <button type="submit" className="submit-button" disabled={loading}>
                        {loading ? (formMode === "add" ? "جاري الإضافة..." : "جاري التحديث...") : (formMode === "add" ? "إضافة" : "تحديث")}
                    </button>
                    {formMode === "edit" && (
                        <button type="button" onClick={resetForm} className="cancel-button" disabled={loading}>
                            إلغاء
                        </button>
                    )}
                </form>
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
