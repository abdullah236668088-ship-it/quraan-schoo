// src/components/AddHalaqaForm.js
import React, { useCallback } from 'react';
import '../Styles/HalaqatPageStyles.css'; // استيراد التنسيقات المشتركة

/**
 * مكون لنموذج إضافة حلقة جديدة.
 * @param {object} props - الخصائص الممررة للمكون.
 * @param {string} props.newHalaqaName - اسم الحلقة الجديدة.
 * @param {function} props.setNewHalaqaName - دالة لتحديث اسم الحلقة الجديدة.
 * @param {string} props.selectedTeacherId - معرف المعلم المختار للحلقة الجديدة.
 * @param {function} props.setSelectedTeacherId - دالة لتحديث معرف المعلم المختار.
 * @param {Array} props.teachers - قائمة بالمعلمين المتاحين.
 * @param {string} props.userRole - دور المستخدم الحالي (e.g., 'admin', 'teacher').
 * @param {boolean} props.loading - لتحديد ما إذا كانت هناك عملية جارية (لتعطيل الأزرار).
 * @param {function} props.onAddHalaqa - دالة يتم استدعاؤها عند إضافة حلقة جديدة.
 * @param {string} props.error - رسالة الخطأ لعرضها.
 * @param {string} props.message - رسالة النجاح لعرضها.
 */
const AddHalaqaForm = ({
    newHalaqaName,
    setNewHalaqaName,
    selectedTeacherId,
    setSelectedTeacherId,
    teachers,
    userRole,
    loading,
    onAddHalaqa,
    error, // يمكن تمرير الخطأ والرسالة لعرضها داخل النموذج إذا لزم الأمر
    message
}) => {
    // استخدام useCallback لضمان استقرار الدالة ومنع إعادة الإنشاء غير الضرورية
    const handleAddClick = useCallback(() => {
        onAddHalaqa();
    }, [onAddHalaqa]);

    // إذا لم يكن المستخدم مسؤولاً أو معلمًا، لا تعرض النموذج
    if (userRole !== "admin" && userRole !== "teacher") {
        return null;
    }

    return (
        <div className="add-halaqa-section card">
            <h3>إضافة حلقة جديدة</h3>
            {error && <p className="error-message">{error}</p>} {/* عرض الخطأ هنا */}
            {message && <p className="success-message">{message}</p>} {/* عرض الرسالة هنا */}
            <input
                type="text"
                placeholder="اسم الحلقة الجديدة"
                value={newHalaqaName}
                onChange={(e) => setNewHalaqaName(e.target.value)}
                className="new-halaqa-input"
                required
            />
            {userRole === "admin" && ( // عرض قائمة اختيار المعلم للمدير فقط
                <select
                    value={selectedTeacherId}
                    onChange={(e) => setSelectedTeacherId(e.target.value)}
                    className="new-halaqa-select-teacher"
                    required
                >
                    <option value="">اختر المعلم</option>
                    {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                            {teacher.name}
                        </option>
                    ))}
                </select>
            )}
            <button onClick={handleAddClick} className="add-halaqa-button" disabled={loading}>
                {loading ? "جاري الإضافة..." : "إضافة حلقة جديدة"}
            </button>
        </div>
    );
};

export default React.memo(AddHalaqaForm); // استخدام React.memo لتحسين الأداء
// لتحسين الأداء ومنع إعادة التقديم غير الضرورية
// يمكن استخدام React.memo إذا كان المكون يتلقى خصائص لا تتغير كثيرًا            