import React, { useEffect, useState, useCallback, useMemo } from "react";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, addDoc, updateDoc, deleteDoc, doc, onSnapshot, writeBatch, orderBy } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import CustomModal from './CustomModal';
import { exportToPdf } from '../utils/pdfExporter';
import { importStudentsFromCSV } from '../utils/csvImporter';
import '../Styles/StudentManagementStyles.css';


export default function StudentManagement() {
    const { currentUser, userRole } = useAuth();

    const [editingStudent, setEditingStudent] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [showModal, setShowModal] = useState(false);

    const [modalConfig, setModalConfig] = useState({});

    const [searchTerm, setSearchTerm] = useState('');
    const [filterHalaqaId, setFilterHalaqaId] = useState('');

    const [csvFile, setCsvFile] = useState(null); // حالة ملف CSV للاستيراد

    const [halaqat, setHalaqat] = useState([]);
    const [allStudents, setAllStudents] = useState([]);

    const initialNewStudentState = useMemo(() => ({
        name: '',
        halaqaId: '',
        gender: 'ذكر',
        birthDate: '',
        contactNumber: '',
        memorization: '',
        notes: ''
    }), []);
    const [newStudent, setNewStudent] = useState(initialNewStudentState);

    useEffect(() => {
        if (!currentUser || !currentUser.uid || (userRole !== "admin" && userRole !== "teacher")) {

            setLoading(false);
            return;
        }

        setLoading(true);
        setError("");
        let unsubscribeHalaqat = () => { };
        let unsubscribeStudents = () => { };

        const setupStudentsListener = (currentHalaqatList, currentHalaqaNamesMap) => {
            let studentsQueryRef = collection(db, "students");
            if (userRole === "teacher") {
                const teacherHalaqaIds = currentHalaqatList.map(h => h.id);
                if (teacherHalaqaIds.length === 0) {
                    setAllStudents([]);
                    setLoading(false);
                    return;
                }
                if (teacherHalaqaIds.length > 10) {
                    setError("عدد الحلقات المرتبطة بالمعلم كبير جدًا. يرجى الاتصال بالدعم.");
                    setLoading(false);
                    return;
                }
                studentsQueryRef = query(studentsQueryRef, where("halaqaId", "in", teacherHalaqaIds), orderBy("name"));
            } else {
                // For admin, order all students by name
                studentsQueryRef = query(studentsQueryRef, orderBy("name"));
            }

            if (unsubscribeStudents) unsubscribeStudents();
            unsubscribeStudents = onSnapshot(studentsQueryRef, (studentsSnapshot) => {
                const studentsList = studentsSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    halaqaName: currentHalaqaNamesMap[doc.data().halaqaId] || "غير معروفة"
                }));
                setAllStudents(studentsList);
                setLoading(false);
            }, (err) => {
                setError("فشل في جلب بيانات الطلاب: " + err.message);
                setLoading(false);
            });
        };

        const setupHalaqatListener = () => {
            let halaqatQueryRef = collection(db, "halaqat");
            if (userRole === "teacher") {
                halaqatQueryRef = query(halaqatQueryRef, where("teacherId", "==", currentUser.uid));
            }
            unsubscribeHalaqat = onSnapshot(halaqatQueryRef, (halaqatSnapshot) => {
                const halaqatList = halaqatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHalaqat(halaqatList);
                const halaqaNamesMap = {};
                halaqatList.forEach(h => halaqaNamesMap[h.id] = h.name);
                setupStudentsListener(halaqatList, halaqaNamesMap);
            }, (err) => {
                setError("فشل في جلب بيانات الحلقات: " + err.message);
                setLoading(false);
            });
        };

        setupHalaqatListener();

        return () => {
            unsubscribeHalaqat();
            unsubscribeStudents();
        };
    }, [currentUser, userRole]);


    const validateStudentData = useCallback((studentData) => {
        if (!studentData.name || !studentData.name.trim()) return "اسم الطالب مطلوب.";
        if (!studentData.halaqaId) return "الحلقة مطلوبة.";
        if (studentData.contactNumber && !/^\d{7,15}$/.test(studentData.contactNumber)) return "رقم الاتصال غير صالح (7-15 رقمًا).";
        return null;
    }, []);

    const handleAddStudent = useCallback(async () => {
        const validationError = validateStudentData(newStudent);
        if (validationError) {
            setError(validationError);
            return;
        }
        setLoading(true);
        try {
            const dataToAdd = { ...newStudent, teacherId: userRole === "teacher" ? currentUser.uid : null };
            await addDoc(collection(db, "students"), dataToAdd);
            setMessage("تم إضافة الطالب بنجاح!");
            setNewStudent(initialNewStudentState);
        } catch (err) {
            setError("فشل في إضافة الطالب: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [newStudent, userRole, currentUser, validateStudentData, initialNewStudentState]);

    const handleEditClick = useCallback((student) => {
        setEditingStudent({ ...student });

        setError("");
        setMessage("");
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }, []);

    const handleUpdateStudent = useCallback(async () => {
        if (!editingStudent) return;
        const validationError = validateStudentData(editingStudent);
        if (validationError) {
            setError(validationError);
            return;
        }
        setLoading(true);
        try {
            const { id, halaqaName, ...dataToUpdate } = editingStudent;
            await updateDoc(doc(db, "students", id), dataToUpdate);
            setMessage("تم تحديث الطالب بنجاح!");
            setEditingStudent(null);
        } catch (err) {
            setError("فشل في تحديث الطالب: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [editingStudent, validateStudentData]);

    const handleDeleteStudent = useCallback((id) => {
        setModalConfig({
            title: "تأكيد الحذف",
            message: "هل أنت متأكد؟ سيتم حذف جميع تقارير الطالب أيضًا. (يفضل نقل هذه العملية للخادم)",
            onConfirm: async () => {
                setShowModal(false);
                setLoading(true);
                try {
                    const reportsQuery = query(collection(db, "weeklyReports"), where("studentId", "==", id));
                    const reportsSnapshot = await getDocs(reportsQuery);
                    const deleteReportPromises = reportsSnapshot.docs.map(reportDoc => deleteDoc(reportDoc.ref));
                    await Promise.all(deleteReportPromises);
                    await deleteDoc(doc(db, "students", id));
                    setMessage("تم حذف الطالب وتقاريره بنجاح!");
                } catch (err) {
                    setError("فشل في حذف الطالب: " + err.message);
                } finally {
                    setLoading(false);
                }
            },
            onCancel: () => setShowModal(false),
            showCancelButton: true,
        });
        setShowModal(true);
    }, []);

    const handleCsvFileChange = (event) => {
        setCsvFile(event.target.files[0]);
    };

    const handleImportStudents = useCallback(async () => {
        await importStudentsFromCSV(csvFile, db, validateStudentData, setLoading, setError, setMessage);
        if (document.getElementById('csv-file-input')) {
            document.getElementById('csv-file-input').value = null;
        }
        setCsvFile(null);
    }, [csvFile, db, validateStudentData]);

    // منطق التصفية والبحث
    const filteredStudents = useMemo(() => {
        return allStudents.filter(student => {
            const matchesHalaqa = filterHalaqaId ? student.halaqaId === filterHalaqaId : true;
            const matchesSearch = searchTerm ? student.name.toLowerCase().includes(searchTerm.toLowerCase()) : true;
            return matchesHalaqa && matchesSearch;
        });
    }, [allStudents, searchTerm, filterHalaqaId]);

    const exportFilteredPdf = useCallback(() => {
        const title = "تقرير بيانات الطلاب";

        const columns = ["الاسم", "الحلقة", "الجنس", "تاريخ الميلاد", "رقم الاتصال", "الحفظ الحالي", "ملاحظات"];
        const rows = filteredStudents.map(s => [s.name, s.halaqaName, s.gender, s.birthDate || "-", s.contactNumber || "-", s.memorization || "-", s.notes || "-"]);
        const fileName = "تقرير_الطلاب";

        exportToPdf(title, columns, rows, fileName);
    }, [filteredStudents]);

    if (userRole !== "admin" && userRole !== "teacher") {
        return <div className="unauthorized-message">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</div>;
    }

    if (loading && allStudents.length === 0) {
        return <p className="loading-message">جاري تحميل بيانات الطلاب...</p>;
    }

    return (
        <div className="student-management-container page-container">
            <h2 className="student-management-title">إدارة الطلاب</h2>
            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            {/* === نموذج التعديل (يظهر فقط عند اختيار طالب) === */}
            {editingStudent && (
                <div className="student-form-section card">
                    <h3>تعديل بيانات الطالب: {editingStudent.name}</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>اسم الطالب:</label>
                            <input type="text" value={editingStudent.name} onChange={(e) => setEditingStudent(s => ({ ...s, name: e.target.value }))} className="form-input" required />
                        </div>
                        <div className="form-group">
                            <label>الحلقة:</label>
                            <select value={editingStudent.halaqaId} onChange={(e) => setEditingStudent(s => ({ ...s, halaqaId: e.target.value }))} className="form-select" required>
                                <option value="">اختر الحلقة</option>
                                {halaqat.map((h) => (<option key={h.id} value={h.id}>{h.name}</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>الجنس:</label>
                            <select value={editingStudent.gender} onChange={(e) => setEditingStudent(s => ({ ...s, gender: e.target.value }))} className="form-select" required>
                                <option value="ذكر">ذكر</option>
                                <option value="أنثى">أنثى</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>تاريخ الميلاد:</label>
                            <input type="date" value={editingStudent.birthDate || ''} onChange={(e) => setEditingStudent(s => ({ ...s, birthDate: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>رقم الاتصال:</label>
                            <input type="text" value={editingStudent.contactNumber || ''} onChange={(e) => setEditingStudent(s => ({ ...s, contactNumber: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>الحفظ الحالي:</label>
                            <input type="text" value={editingStudent.memorization || ''} onChange={(e) => setEditingStudent(s => ({ ...s, memorization: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group full-width">
                            <label>ملاحظات:</label>
                            <textarea value={editingStudent.notes || ''} onChange={(e) => setEditingStudent(s => ({ ...s, notes: e.target.value }))} className="form-textarea" />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button onClick={handleUpdateStudent} className="submit-button" disabled={loading}>
                            {loading ? "جاري التحديث..." : "تحديث الطالب"}
                        </button>
                        <button type="button" onClick={() => setEditingStudent(null)} className="cancel-button" disabled={loading}>
                            إلغاء التعديل
                        </button>
                    </div>
                </div>
            )}

            {/* === نموذج الإضافة (يظهر فقط في حال عدم وجود تعديل) === */}
            {!editingStudent && (
                <div className="student-form-section card">
                    <h3>إضافة طالب جديد</h3>
                    <div className="form-grid">
                        <div className="form-group">
                            <label>اسم الطالب:</label>
                            <input type="text" value={newStudent.name} onChange={(e) => setNewStudent(s => ({ ...s, name: e.target.value }))} className="form-input" required />
                        </div>
                        <div className="form-group">
                            <label>الحلقة:</label>
                            <select value={newStudent.halaqaId} onChange={(e) => setNewStudent(s => ({ ...s, halaqaId: e.target.value }))} className="form-select" required>
                                <option value="">اختر الحلقة</option>
                                {halaqat.map((h) => (<option key={h.id} value={h.id}>{h.name}</option>))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>الجنس:</label>
                            <select value={newStudent.gender} onChange={(e) => setNewStudent(s => ({ ...s, gender: e.target.value }))} className="form-select">
                                <option value="ذكر">ذكر</option>
                                <option value="أنثى">أنثى</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label>تاريخ الميلاد:</label>
                            <input type="date" value={newStudent.birthDate} onChange={(e) => setNewStudent(s => ({ ...s, birthDate: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>رقم الاتصال:</label>
                            <input type="text" value={newStudent.contactNumber} onChange={(e) => setNewStudent(s => ({ ...s, contactNumber: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group">
                            <label>الحفظ الحالي:</label>
                            <input type="text" value={newStudent.memorization} onChange={(e) => setNewStudent(s => ({ ...s, memorization: e.target.value }))} className="form-input" />
                        </div>
                        <div className="form-group full-width">
                            <label>ملاحظات:</label>
                            <textarea value={newStudent.notes} onChange={(e) => setNewStudent(s => ({ ...s, notes: e.target.value }))} className="form-textarea" />
                        </div>
                    </div>
                    <div className="form-actions">
                        <button onClick={handleAddStudent} className="submit-button" disabled={loading}>
                            {loading ? "جاري الإضافة..." : "إضافة طالب"}
                        </button>
                    </div>
                </div>
            )}

            {/* === قسم قائمة الطلاب والتحكم === */}
            <div className="students-list-section card">
                <h3>الطلاب المسجلون ({filteredStudents.length})</h3>
                <div className="table-controls">
                    <input
                        type="text"
                        placeholder="ابحث بالاسم..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="search-input"
                    />
                    <select value={filterHalaqaId} onChange={(e) => setFilterHalaqaId(e.target.value)} className="filter-select">
                        <option value="">كل الحلقات</option>
                        {halaqat.map((h) => (<option key={h.id} value={h.id}>{h.name}</option>))}
                    </select>
                    <button onClick={exportFilteredPdf} className="export-pdf-button" disabled={filteredStudents.length === 0}>
                        تصدير القائمة الحالية (PDF)
                    </button>
                </div>

                <div className="import-section">
                    <h4>استيراد من ملف CSV</h4>
                    <input type="file" id="csv-file-input" accept=".csv" onChange={handleCsvFileChange} />
                    <button onClick={handleImportStudents} disabled={!csvFile || loading} className="import-button">
                        {loading ? 'جاري الاستيراد...' : 'استيراد الطلاب'}
                    </button>
                </div>

                <div className="students-table-container">
                    {filteredStudents.length > 0 ? (
                        <table className="students-table">
                            <thead>
                                <tr>
                                    <th>الاسم</th>
                                    <th>الحلقة</th>
                                    <th>الجنس</th>
                                    <th>تاريخ الميلاد</th>
                                    <th>رقم الاتصال</th>
                                    <th>الحفظ الحالي</th>
                                    <th>ملاحظات</th>
                                    <th>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredStudents.map((student) => (
                                    <tr key={student.id}>
                                        <td>{student.name}</td>
                                        <td>{student.halaqaName}</td>
                                        <td>{student.gender}</td>
                                        <td>{student.birthDate || '-'}</td>
                                        <td>{student.contactNumber || '-'}</td>
                                        <td>{student.memorization || '-'}</td>
                                        <td>{student.notes || '-'}</td>
                                        <td className="actions-cell">
                                            <button onClick={() => handleEditClick(student)} className="edit-button">تعديل</button>
                                            <button onClick={() => handleDeleteStudent(student.id)} className="delete-button">حذف</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <p className="no-data-message">
                            {searchTerm || filterHalaqaId ? "لا توجد نتائج تطابق بحثك." : "لا يوجد طلاب مسجلون حاليًا."}
                        </p>
                    )}
                </div>
            </div>

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