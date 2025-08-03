import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebaseConfig"; // تم إزالة auth لأنه غير مستخدم مباشرة هنا
import {
    collection,
    query,
    where,
    getDocs,
    addDoc,
    serverTimestamp,
    // documentId, // تم إزالة documentId لأنه غير مستخدم
    orderBy,
    limit,
    doc,
    getDoc,
    onSnapshot,
    updateDoc
} from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import '../Styles/WeeklyReportsStyles.css';

// قائمة بأسماء سور القرآن الكريم للبحث التلقائي
const surahNames = [
    "الفاتحة", "البقرة", "آل عمران", "النساء", "المائدة", "الأنعام", "الأعراف", "الأنفال", "التوبة", "يونس",
    "هود", "يوسف", "الرعد", "إبراهيم", "الحجر", "النحل", "الإسراء", "الكهف", "مريم", "طه",
    "الأنبياء", "الحج", "المؤمنون", "النور", "الفرقان", "الشعراء", "النمل", "القصص", "العنكبوت", "الروم",
    "لقمان", "السجدة", "الأحزاب", "سبأ", "فاطر", "يس", "الصافات", "ص", "الزمر", "غافر",
    "فصلت", "الشورى", "الزخرف", "الدخان", "الجاثية", "الأحقاف", "محمد", "الفتح", "الحجرات", "ق",
    "الذاريات", "الطور", "النجم", "القمر", "الرحمن", "الواقعة", "الحديد", "المجادلة", "الحشر", "الممتحنة",
    "الصف", "الجمعة", "المنافقون", "التغابن", "الطلاق", "التحريم", "الملك", "القلم", "الحاقة", "المعارج",
    "نوح", "الجن", "المزمل", "المدثر", "القيامة", "الإنسان", "المرسلات", "النبأ", "النازعات", "عبس",
    "التكوير", "الإنفطار", "المطففين", "الإنشقاق", "البروج", "الطارق", "الأعلى", "الغاشية", "الفجر", "البلد",
    "الشمس", "الليل", "الضحى", "الشرح", "التين", "العلق", "القدر", "البينة", "الزلزلة", "العاديات",
    "القارعة", "التكاثر", "العصر", "الهمزة", "الفيل", "قريش", "الماعون", "الكوثر", "الكافرون", "النصر",
    "المسد", "الإخلاص", "الفلق", "الناس"
];

export default function WeeklyReports() {
    const { currentUser, userRole } = useAuth();
    const [students, setStudents] = useState([]);
    const [halaqat, setHalaqat] = useState([]);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [selectedHalaqaId, setSelectedHalaqaId] = useState("");
    const [reportDate, setReportDate] = useState("");
    const [pagesMemorized, setPagesMemorized] = useState(0);
    const [partsRevised, setPartsRevised] = useState(0);
    const [attendanceDays, setAttendanceDays] = useState(0);
    const [notes, setNotes] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [message, setMessage] = useState(""); // لرسائل النجاح

    // حالة للحفظ الجديد (للبحث التلقائي)
    const [newMemorization, setNewMemorization] = useState("");
    const [filteredSurahs, setFilteredSurahs] = useState([]);

    // دالة لحساب التقييم بناءً على المدخلات
    const calculatedRating = useCallback(() => {
        // يمكن تعديل هذه المعادلة لتناسب معايير التقييم الخاصة بك
        const memScore = (pagesMemorized / 10) * 40; // افتراض: كل 10 صفحات = 40 نقطة
        const revScore = (partsRevised / 5) * 30;   // افتراض: كل 5 أجزاء = 30 نقطة
        const attScore = (attendanceDays / 6) * 30; // افتراض: 6 أيام حضور = 30 نقطة
        const total = memScore + revScore + attScore;
        return Math.min(100, Math.round(total)); // لا يتجاوز 100
    }, [pagesMemorized, partsRevised, attendanceDays]);

    // جلب الطلاب والحلقات المرتبطة بالمعلم الحالي
    useEffect(() => {
        if (!currentUser || !currentUser.uid || userRole !== "teacher") {
            setLoading(false);
            setError("ليس لديك الصلاحية لإضافة تقارير أسبوعية.");
            return;
        }

        setLoading(true);
        setError("");

        let unsubscribeHalaqat = () => { };
        let unsubscribeStudentsArray = []; // مصفوفة لتخزين دوال إلغاء الاشتراك للطلاب

        // Listener for Halaqat
        const setupHalaqatListener = () => {
            const halaqatQueryRef = query(collection(db, "halaqat"), where("teacherId", "==", currentUser.uid));
            unsubscribeHalaqat = onSnapshot(halaqatQueryRef, (halaqatSnapshot) => {
                const halaqatList = halaqatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setHalaqat(halaqatList);

                const teacherHalaqaIds = halaqatList.map(h => h.id);

                // إلغاء الاشتراك من المستمعين السابقين للطلاب قبل إعداد مستمعين جدد
                unsubscribeStudentsArray.forEach(unsub => unsub());
                unsubscribeStudentsArray = []; // تفريغ المصفوفة

                if (teacherHalaqaIds.length > 0) {
                    // إعداد مستمعي الطلاب الجدد
                    unsubscribeStudentsArray = setupStudentsListener(teacherHalaqaIds);
                } else {
                    setStudents([]);
                    setLoading(false);
                }
            }, (err) => {
                console.error("Error fetching halaqat in real-time:", err);
                setError("فشل في جلب بيانات الحلقات في الوقت الفعلي: " + err.message);
                setLoading(false);
            });
        };

        // Listener for Students (معالجة قيد 'in' query)
        const setupStudentsListener = (teacherHalaqaIds) => {
            if (teacherHalaqaIds.length === 0) {
                setStudents([]);
                setLoading(false);
                return [];
            }

            const unsubscribes = [];
            const chunkSize = 10; // الحد الأقصى لعناصر 'in' query
            const chunks = [];
            for (let i = 0; i < teacherHalaqaIds.length; i += chunkSize) {
                chunks.push(teacherHalaqaIds.slice(i, i + chunkSize));
            }

            // استخدام Map لتخزين الطلاب من كل جزء ودمجهم لاحقًا
            const studentsByChunk = new Map();
            let initialLoadsCompleted = 0;

            chunks.forEach((chunk, index) => {
                const studentsQueryRef = query(collection(db, "students"), where("halaqaId", "in", chunk));
                const unsubscribe = onSnapshot(studentsQueryRef, (studentsSnapshot) => {
                    const chunkStudents = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    studentsByChunk.set(index, chunkStudents); // تخزين الطلاب لهذا الجزء

                    if (initialLoadsCompleted < chunks.length) {
                        initialLoadsCompleted++;
                    }

                    // عندما تكتمل جميع التحميلات الأولية (أو عند أي تحديث لاحق)، قم بدمج وتحديث حالة الطلاب
                    if (initialLoadsCompleted === chunks.length) {
                        const mergedStudents = Array.from(studentsByChunk.values()).flat();
                        // إزالة أي تكرارات إذا كان الطالب يمكن أن ينتمي لأكثر من حلقة (غير محتمل في هذا السياق ولكنها ممارسة جيدة)
                        const uniqueStudents = Array.from(new Map(mergedStudents.map(s => [s.id, s])).values());
                        setStudents(uniqueStudents);
                        setLoading(false);
                    }
                }, (err) => {
                    console.error(`Error fetching students for chunk ${index} in real-time:`, err);
                    setError("فشل في جلب بيانات الطلاب في الوقت الفعلي: " + err.message);
                    setLoading(false);
                });
                unsubscribes.push(unsubscribe);
            });
            return unsubscribes; // إرجاع مصفوفة دوال إلغاء الاشتراك
        };

        setupHalaqatListener(); // بدء العملية

        // دالة التنظيف لإلغاء الاشتراك من جميع المستمعين
        return () => {
            unsubscribeHalaqat();
            unsubscribeStudentsArray.forEach(unsub => unsub());
        };

    }, [currentUser, userRole]); // اعتماديات useEffect

    // تحديث قائمة الطلاب عند تغيير الحلقة
    const getStudentsInSelectedHalaqa = useCallback(() => {
        if (!selectedHalaqaId) {
            return students; // إذا لم يتم اختيار حلقة، اعرض جميع الطلاب المرتبطين بالمعلم
        }
        return students.filter(student => student.halaqaId === selectedHalaqaId);
    }, [students, selectedHalaqaId]);

    // دالة لمسح النموذج
    const resetForm = useCallback(() => {
        setSelectedStudentId("");
        setSelectedHalaqaId("");
        setReportDate("");
        setPagesMemorized(0);
        setPartsRevised(0);
        setAttendanceDays(0);
        setNotes("");
        setNewMemorization("");
        setFilteredSurahs([]);
        setError("");
    }, []);

    // دالة للتعامل مع البحث التلقائي عن السور
    const handleMemorizationChange = useCallback((e) => {
        const value = e.target.value;
        setNewMemorization(value);
        if (value.length > 0) {
            const filtered = surahNames.filter(surah =>
                surah.toLowerCase().includes(value.toLowerCase())
            );
            setFilteredSurahs(filtered);
        } else {
            setFilteredSurahs([]);
        }
    }, []);

    const selectSurah = useCallback((surah) => {
        setNewMemorization(surah);
        setFilteredSurahs([]);
    }, []);

    // دالة لإرسال التقرير الأسبوعي
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        setError("");
        setMessage("");

        // التحقق من صحة المدخلات
        if (!selectedStudentId || !selectedHalaqaId || !reportDate) {
            setError("الرجاء اختيار الطالب والحلقة وتاريخ التقرير.");
            return;
        }
        if (pagesMemorized < 0 || partsRevised < 0 || attendanceDays < 0 || attendanceDays > 6) {
            setError("الرجاء إدخال قيم صحيحة للحفظ والمراجعة وأيام الحضور (0-6).");
            return;
        }

        setLoading(true);
        try {
            const studentDoc = await getDoc(doc(db, "students", selectedStudentId));
            const studentData = studentDoc.exists() ? studentDoc.data() : null;

            if (!studentData) {
                setError("الطالب المحدد غير موجود.");
                setLoading(false);
                return;
            }

            // تحديث الحفظ الحالي للطالب
            await updateDoc(doc(db, "students", selectedStudentId), {
                memorization: newMemorization || studentData.memorization, // تحديث الحفظ إذا تم إدخال جديد
            });

            // إضافة التقرير الأسبوعي
            await addDoc(collection(db, "weeklyReports"), {
                studentId: selectedStudentId,
                halaqaId: selectedHalaqaId,
                teacherId: currentUser.uid,
                reportDate: new Date(reportDate), // تحويل التاريخ إلى كائن Date
                pagesMemorized: parseInt(pagesMemorized),
                partsRevised: parseInt(partsRevised),
                attendanceDays: parseInt(attendanceDays),
                rating: calculatedRating(),
                notes: notes,
                createdAt: serverTimestamp(), // ختم الوقت
            });

            // عرض رسالة نجاح ومسح النموذج
            setMessage("تم حفظ التقرير الأسبوعي بنجاح!");
            resetForm();
            setTimeout(() => setMessage(""), 5000); // إخفاء الرسالة بعد 5 ثوانٍ
        } catch (err) {
            console.error("Error submitting weekly report:", err);
            setError("فشل في حفظ التقرير: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedStudentId, selectedHalaqaId, reportDate, pagesMemorized, partsRevised, attendanceDays, notes, newMemorization, calculatedRating, currentUser, resetForm]);


    if (!['admin', 'teacher'].includes(userRole)) {
        return <p className="unauthorized-message">ليس لديك الصلاحية لإضافة تقارير أسبوعية.</p>;
    }

    if (loading) {
        return <p className="loading-message">جاري تحميل البيانات...</p>;
    }

    return (
        <div className="weekly-reports-container page-container">
            <h2 className="weekly-reports-title">إضافة تقرير أسبوعي</h2>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="success-message">{message}</p>}

            <form onSubmit={handleSubmit} className="report-form card">
                <div className="form-grid">
                    <div className="form-group">
                        <label htmlFor="halaqa-select">اختر الحلقة:</label>
                        <select
                            id="halaqa-select"
                            value={selectedHalaqaId}
                            onChange={(e) => {
                                setSelectedHalaqaId(e.target.value);
                                setSelectedStudentId(""); // مسح اختيار الطالب عند تغيير الحلقة
                            }}
                            className="form-select"
                            required
                            disabled={loading}
                        >
                            <option value="">اختر حلقة</option>
                            {halaqat.map((halaqa) => (
                                <option key={halaqa.id} value={halaqa.id}>
                                    {halaqa.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="student-select">اختر الطالب:</label>
                        <select
                            id="student-select"
                            value={selectedStudentId}
                            onChange={(e) => setSelectedStudentId(e.target.value)}
                            className="form-select"
                            required
                            disabled={loading || !selectedHalaqaId}
                        >
                            <option value="">اختر طالب</option>
                            {getStudentsInSelectedHalaqa().map((student) => (
                                <option key={student.id} value={student.id}>
                                    {student.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="report-date">تاريخ التقرير:</label>
                        <input
                            type="date"
                            id="report-date"
                            value={reportDate}
                            onChange={(e) => setReportDate(e.target.value)}
                            className="form-input"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="pages-memorized">الصفحات المحفوظة:</label>
                        <input
                            type="number"
                            id="pages-memorized"
                            min="0"
                            value={pagesMemorized}
                            onChange={(e) => setPagesMemorized(e.target.value)}
                            className="form-input"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="parts-revised">الأجزاء المراجعة:</label>
                        <input
                            type="number"
                            id="parts-revised"
                            min="0"
                            value={partsRevised}
                            onChange={(e) => setPartsRevised(e.target.value)}
                            className="form-input"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="attendance-days">أيام الحضور (0-6):</label>
                        <input
                            type="number"
                            id="attendance-days"
                            min="0"
                            max="6"
                            value={attendanceDays}
                            onChange={(e) => setAttendanceDays(e.target.value)}
                            className="form-input"
                            required
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="new-memorization">الحفظ الجديد (اسم السورة):</label>
                        <input
                            type="text"
                            id="new-memorization"
                            value={newMemorization}
                            onChange={handleMemorizationChange}
                            placeholder="مثال: البقرة"
                            className="form-input"
                            disabled={loading}
                        />
                        {filteredSurahs.length > 0 && newMemorization.length > 0 && (
                            <ul className="autocomplete-results">
                                {filteredSurahs.map((surah, index) => (
                                    <li key={index} onClick={() => selectSurah(surah)}>
                                        {surah}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    <div className="form-group">
                        <label htmlFor="rating">التقييم (0-100):</label>
                        <input
                            type="number"
                            id="rating"
                            min="0"
                            max="100"
                            value={calculatedRating()}
                            readOnly
                            className="form-input read-only-input"
                            disabled={loading}
                        />
                    </div>

                    <div className="form-group full-width">
                        <label htmlFor="notes">ملاحظات:</label>
                        <textarea
                            id="notes"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="form-textarea"
                            disabled={loading}
                        />
                    </div>
                </div>
                <button type="submit" className="submit-button" disabled={loading}>
                    {loading ? "جاري الحفظ..." : "حفظ التقرير"}
                </button>
            </form>
        </div>
    );
}

