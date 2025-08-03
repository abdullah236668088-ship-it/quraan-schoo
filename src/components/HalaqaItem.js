import React, { useState, useCallback, useEffect } from 'react';

/**
 * مكون لعرض وتعديل حلقة واحدة.
 * @param {object} props - الخصائص الممررة للمكون.
 * @param {object} props.halaqa - بيانات الحلقة (id, name, teacherId, teacherName).
 * @param {boolean} props.isEditing - لتحديد ما إذا كان المكون في وضع التعديل.
 * @param {function} props.onEdit - دالة يتم استدعاؤها عند الضغط على زر التعديل.
 * @param {function} props.onDelete - دالة يتم استدعاؤها عند الضغط على زر الحذف.
 * @param {function} props.onSave - دالة يتم استدعاؤها عند حفظ التعديلات.
 * @param {function} props.onCancel - دالة يتم استدعاؤها عند إلغاء التعديل.
 * @param {Array} props.teachers - قائمة بالمعلمين المتاحين.
 * @param {string} props.userRole - دور المستخدم الحالي (e.g., 'admin').
 * @param {boolean} props.loading - لتحديد ما إذا كانت هناك عملية جارية (لتعطيل الأزرار).
 */
const HalaqaItem = ({ halaqa, isEditing, onEdit, onDelete, onSave, onCancel, teachers, userRole, loading }) => {
    const [editedName, setEditedName] = useState(halaqa.name);
    const [editedTeacherId, setEditedTeacherId] = useState(halaqa.teacherId || "");

    // استخدام useEffect لمزامنة الحالة الداخلية مع الـ props عند تغييرها
    useEffect(() => {
        if (isEditing) {
            setEditedName(halaqa.name);
            setEditedTeacherId(halaqa.teacherId || "");
        }
    }, [halaqa, isEditing]);

    const handleSave = useCallback(() => {
        onSave(halaqa.id, editedName, editedTeacherId);
    }, [halaqa.id, editedName, editedTeacherId, onSave]);

    if (isEditing) {
        return (
            // نموذج التعديل
            <div className="edit-halaqa-form">
                <input
                    type="text"
                    value={editedName}
                    onChange={(e) => setEditedName(e.target.value)}
                    className="edit-halaqa-input"
                    required
                />
                {userRole === "admin" && (
                    <select
                        value={editedTeacherId}
                        onChange={(e) => setEditedTeacherId(e.target.value)}
                        className="edit-halaqa-select-teacher"
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
                <button onClick={handleSave} className="save-button" disabled={loading}>
                    {loading ? "جاري الحفظ..." : "حفظ"}
                </button>
                <button onClick={onCancel} className="cancel-button" disabled={loading}>
                    إلغاء
                </button>
            </div>
        );
    }

    return (
        <>
            <div className="halaqa-details">
                <span>{halaqa.name} ({halaqa.teacherName || 'لا يوجد معلم'})</span>
            </div>
            <div className="halaqa-actions">
                <button onClick={() => onEdit(halaqa)} className="edit-button">تعديل</button>
                <button onClick={() => onDelete(halaqa.id)} className="delete-button">حذف</button>
            </div>
        </>
    );
};

// استخدام React.memo لتحسين الأداء عن طريق منع إعادة العرض غير الضرورية
export default React.memo(HalaqaItem);

