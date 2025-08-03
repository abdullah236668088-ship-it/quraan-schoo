// src/pages/ReportsPage.js
import React, { useState, useEffect, useCallback } from "react";
import { db } from "../firebaseConfig";
import {
    collection,
    query,
    where,
    getDocs,
    orderBy,
} from "firebase/firestore";
import { exportToPdf } from "../utils/pdfExporter"; // استيراد دالة تصدير PDF
import { useAuth } from "../contexts/AuthContext";
import '../Styles/ReportsPageStyles.css';

// استيراد مكونات Chart.js اللازمة
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from "react-chartjs-2";

// تسجيل مكونات Chart.js
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function ReportsPage() {
    const { currentUser, userRole } = useAuth(); // جلب المستخدم الحالي ودوره
    const [reports, setReports] = useState([]); // لتخزين بيانات التقارير
    const [students, setStudents] = useState([]); // لتخزين بيانات الطلاب (للتصفية)
    const [halaqat, setHalaqat] = useState([]); // لتخزين بيانات الحلقات (للتصفية)
    const [teachers, setTeachers] = useState([]); // لتخزين بيانات المعلمين (للعرض والتصفية)
    const [loading, setLoading] = useState(true); // حالة التحميل
    const [error, setError] = useState(""); // رسالة الخطأ
    const [showReport, setShowReport] = useState(false); // للتحكم في عرض جدول التقرير والرسوم البيانية

    // حالات التصفية
    const [selectedStudent, setSelectedStudent] = useState("");
    const [selectedHalaqa, setSelectedHalaqa] = useState("");
    const [selectedTeacher, setSelectedTeacher] = useState(""); // حقل جديد لتصفية المعلمين
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");

    // حالات بيانات الرسم البياني الإجمالي (للتصفية الحالية)
    const [overallChartData, setOverallChartData] = useState(null);
    // حالة بيانات الرسم البياني للمتوسطات الشهرية
    const [monthlyAverageChartData, setMonthlyAverageChartData] = useState(null);

    /**
     * دالة مساعدة لجلب جميع الطلاب والحلقات والمعلمين.
     * تُستخدم لملء قوائم التصفية ولعرض الأسماء بدلاً من المعرفات.
     */
    const fetchDropdownData = useCallback(async () => {
        if (!currentUser) return;
        try {
            let studentsQuery = collection(db, "students");
            let halaqatQuery = collection(db, "halaqat");

            // إذا كان المستخدم معلمًا، قم بتصفية بيانات القوائم المنسدلة
            if (userRole === 'teacher') {
                const teacherHalaqatSnapshot = await getDocs(query(collection(db, "halaqat"), where("teacherId", "==", currentUser.uid)));
                const teacherHalaqaIds = teacherHalaqatSnapshot.docs.map(doc => doc.id);

                if (teacherHalaqaIds.length > 0) {
                    // جلب الطلاب فقط من حلقات المعلم
                    studentsQuery = query(collection(db, "students"), where("halaqaId", "in", teacherHalaqaIds));
                    // جلب حلقات المعلم فقط
                    halaqatQuery = query(collection(db, "halaqat"), where("teacherId", "==", currentUser.uid));
                } else {
                    // لا يوجد حلقات، لا حاجة لجلب الطلاب
                    setStudents([]);
                    setHalaqat([]);
                    setTeachers([]);
                    return;
                }
            }

            const [studentsSnapshot, halaqatSnapshot, usersSnapshot] = await Promise.all([
                getDocs(studentsQuery),
                getDocs(halaqatQuery),
                getDocs(query(collection(db, "users"), where("role", "==", "teacher"))), // جلب المعلمين فقط
            ]);

            const studentsList = studentsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const halaqatList = halaqatSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            const teachersList = usersSnapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name || doc.data().email }));

            setStudents(studentsList);
            setHalaqat(halaqatList);
            setTeachers(teachersList);
        } catch (err) {
            console.error("Error fetching dropdown data:", err);
            setError("فشل في جلب بيانات القوائم المنسدلة.");
        }
    }, [currentUser, userRole]);

    // جلب بيانات القوائم المنسدلة عند تحميل المكون
    useEffect(() => {
        fetchDropdownData();
    }, [fetchDropdownData]);

    /**
     * دالة لجلب التقارير بناءً على معايير التصفية.
     * تقوم أيضًا بحساب البيانات للرسوم البيانية الإجمالية والشهرية.
     */
    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError("");
        setReports([]); // مسح التقارير السابقة
        setOverallChartData(null); // مسح بيانات الرسم البياني الإجمالي السابقة
        setMonthlyAverageChartData(null); // مسح بيانات الرسم البياني للمتوسطات الشهرية السابقة
        setShowReport(false); // إخفاء منطقة التقرير حتى يتم جلب البيانات

        let reportsQuery = collection(db, "weeklyReports");
        let conditions = [];

        // تصفية حسب الطالب
        if (selectedStudent) {
            conditions.push(where("studentId", "==", selectedStudent));
        }
        // تصفية حسب الحلقة
        if (selectedHalaqa) {
            conditions.push(where("halaqaId", "==", selectedHalaqa));
        }
        // تصفية حسب المعلم (إذا كان الدور معلم، أو إذا اختار المدير معلمًا)
        if (userRole === 'teacher' && currentUser?.uid) {
            const teacherHalaqat = halaqat.filter(h => h.teacherId === currentUser.uid).map(h => h.id);
            if (teacherHalaqat.length > 0) {
                conditions.push(where("halaqaId", "in", teacherHalaqat));
            } else {
                setLoading(false);
                setError("ليس لديك حلقات مرتبطة لعرض التقارير.");
                return;
            }
        } else if (userRole === 'admin' && selectedTeacher) {
            const teacherHalaqat = halaqat.filter(h => h.teacherId === selectedTeacher).map(h => h.id);
            if (teacherHalaqat.length > 0) {
                conditions.push(where("halaqaId", "in", teacherHalaqat));
            } else {
                setLoading(false);
                setError("المعلم المحدد ليس لديه حلقات مرتبطة.");
                return;
            }
        }

        // تصفية حسب نطاق التاريخ
        if (startDate) {
            conditions.push(where("reportDate", ">=", startDate));
        }
        if (endDate) {
            conditions.push(where("reportDate", "<=", endDate));
        }

        try {
            // بناء الاستعلام مع جميع الشروط والترتيب
            const q = query(reportsQuery, ...conditions, orderBy("reportDate", "asc")); // ترتيب تصاعدي للتاريخ للمتوسطات الشهرية

            const querySnapshot = await getDocs(q);
            const reportsList = [];
            let totalPagesMemorizedOverall = 0;
            let totalPartsRevisedOverall = 0;
            let totalAttendanceDaysOverall = 0;
            let totalRatingOverall = 0;
            let reportCountOverall = 0;

            // كائن لتجميع البيانات الشهرية
            const monthlyAggregates = {};

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const studentName = students.find(s => s.id === data.studentId)?.name || "غير معروف";
                const halaqaName = halaqat.find(h => h.id === data.halaqaId)?.name || "غير معروف";
                const teacherIdFromHalaqa = halaqat.find(h => h.id === data.halaqaId)?.teacherId;
                const teacherName = teachers.find(t => t.id === teacherIdFromHalaqa)?.name || "غير معروف";

                reportsList.push({
                    id: doc.id,
                    studentName,
                    halaqaName,
                    teacherName,
                    reportDateFormatted: data.reportDate,
                    ...data
                });

                // تجميع البيانات للرسم البياني الإجمالي
                totalPagesMemorizedOverall += (data.pagesMemorized || 0);
                totalPartsRevisedOverall += (data.partsRevised || 0);
                totalAttendanceDaysOverall += (data.attendanceDays || 0);
                totalRatingOverall += (data.rating || 0);
                reportCountOverall++;

                // تجميع البيانات للمتوسطات الشهرية
                const reportDate = new Date(data.reportDate); // تحويل التاريخ إلى كائن Date
                const yearMonthKey = `${reportDate.getFullYear()}-${(reportDate.getMonth() + 1).toString().padStart(2, '0')}`; // YYYY-MM
                const monthYearLabel = reportDate.toLocaleString('ar-EG', { month: 'long', year: 'numeric' }); // اسم الشهر والسنة بالعربية

                if (!monthlyAggregates[yearMonthKey]) {
                    monthlyAggregates[yearMonthKey] = {
                        monthLabel: monthYearLabel,
                        totalPagesMemorized: 0,
                        totalPartsRevised: 0,
                        totalAttendanceDays: 0,
                        totalRating: 0,
                        count: 0
                    };
                }
                monthlyAggregates[yearMonthKey].totalPagesMemorized += (data.pagesMemorized || 0);
                monthlyAggregates[yearMonthKey].totalPartsRevised += (data.partsRevised || 0);
                monthlyAggregates[yearMonthKey].totalAttendanceDays += (data.attendanceDays || 0);
                monthlyAggregates[yearMonthKey].totalRating += (data.rating || 0);
                monthlyAggregates[yearMonthKey].count++;
            });

            setReports(reportsList);
            setShowReport(true); // عرض منطقة التقرير إذا كانت هناك بيانات

            // إعداد بيانات الرسم البياني الإجمالي
            if (reportCountOverall > 0) {
                setOverallChartData({
                    labels: ['إجمالي الحفظ (صفحات)', 'إجمالي المراجعة (أجزاء)', 'إجمالي الحضور (أيام)', 'متوسط التقييم'],
                    datasets: [
                        {
                            label: 'إحصائيات التقارير المحددة',
                            data: [
                                totalPagesMemorizedOverall,
                                totalPartsRevisedOverall,
                                totalAttendanceDaysOverall,
                                (totalRatingOverall / reportCountOverall).toFixed(2)
                            ],
                            backgroundColor: [
                                'rgba(54, 162, 235, 0.6)',
                                'rgba(75, 192, 192, 0.6)',
                                'rgba(153, 102, 255, 0.6)',
                                'rgba(255, 159, 64, 0.6)',
                            ],
                            borderColor: [
                                'rgba(54, 162, 235, 1)',
                                'rgba(75, 192, 192, 1)',
                                'rgba(153, 102, 255, 1)',
                                'rgba(255, 159, 64, 1)',
                            ],
                            borderWidth: 1,
                        },
                    ],
                });
            } else {
                setOverallChartData(null);
            }

            // إعداد بيانات الرسم البياني للمتوسطات الشهرية
            const sortedMonths = Object.keys(monthlyAggregates).sort(); // ترتيب الشهور زمنيًا

            if (sortedMonths.length > 0) {
                const chartLabels = sortedMonths.map(monthKey => monthlyAggregates[monthKey].monthLabel);
                const avgMemorizedData = sortedMonths.map(monthKey => (monthlyAggregates[monthKey].totalPagesMemorized / monthlyAggregates[monthKey].count).toFixed(2));
                const avgRevisedData = sortedMonths.map(monthKey => (monthlyAggregates[monthKey].totalPartsRevised / monthlyAggregates[monthKey].count).toFixed(2));
                const avgAttendanceData = sortedMonths.map(monthKey => (monthlyAggregates[monthKey].totalAttendanceDays / monthlyAggregates[monthKey].count).toFixed(2));
                const avgRatingData = sortedMonths.map(monthKey => (monthlyAggregates[monthKey].totalRating / monthlyAggregates[monthKey].count).toFixed(2));

                setMonthlyAverageChartData({
                    labels: chartLabels,
                    datasets: [
                        {
                            label: 'متوسط الحفظ (صفحات)',
                            data: avgMemorizedData,
                            backgroundColor: 'rgba(54, 162, 235, 0.6)',
                            borderColor: 'rgba(54, 162, 235, 1)',
                            borderWidth: 1,
                        },
                        {
                            label: 'متوسط المراجعة (أجزاء)',
                            data: avgRevisedData,
                            backgroundColor: 'rgba(75, 192, 192, 0.6)',
                            borderColor: 'rgba(75, 192, 192, 1)',
                            borderWidth: 1,
                        },
                        {
                            label: 'متوسط الحضور (أيام)',
                            data: avgAttendanceData,
                            backgroundColor: 'rgba(153, 102, 255, 0.6)',
                            borderColor: 'rgba(153, 102, 255, 1)',
                            borderWidth: 1,
                        },
                        {
                            label: 'متوسط التقييم',
                            data: avgRatingData,
                            backgroundColor: 'rgba(255, 159, 64, 0.6)',
                            borderColor: 'rgba(255, 159, 64, 1)',
                            borderWidth: 1,
                        },
                    ],
                });
            } else {
                setMonthlyAverageChartData(null);
            }

        } catch (err) {
            console.error("Error fetching reports:", err);
            setError("فشل في جلب التقارير: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [selectedStudent, selectedHalaqa, selectedTeacher, startDate, endDate, students, halaqat, teachers, userRole, currentUser]);

    // دالة لتصدير التقارير المعروضة حاليًا إلى PDF
    const handleExportPdf = () => {
        if (reports.length === 0) {
            // يمكن استبدال هذا بمودال مخصص بدلاً من alert()
            alert("لا توجد تقارير لتصديرها.");
            return;
        }

        // تحديد اسم المعلم ليتم عرضه في رأس التقرير
        let teacherNameToExport = null;
        if (userRole === 'admin' && selectedTeacher) {
            const selectedTeacherObject = teachers.find(t => t.id === selectedTeacher);
            teacherNameToExport = selectedTeacherObject ? selectedTeacherObject.name : null;
        } else if (userRole === 'teacher' && currentUser?.displayName) {
            teacherNameToExport = currentUser.displayName;
        } else if (userRole === 'teacher' && currentUser?.email) {
            teacherNameToExport = currentUser.email;
        }

        // تحديد اسم الشهر والسنة ونوع التقرير بناءً على التواريخ المختارة
        let monthName = null;
        let year = null;
        let currentReportType = 'custom'; // الافتراضي

        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);

            const monthNamesArabic = [
                "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
                "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
            ];

            if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
                monthName = monthNamesArabic[start.getMonth()];
                year = start.getFullYear().toString();
                currentReportType = 'monthly';
            } else if (start.getFullYear() === end.getFullYear() &&
                start.getMonth() === 0 && end.getMonth() === 11 &&
                start.getDate() === 1 && end.getDate() === 31) {
                year = start.getFullYear().toString();
                currentReportType = 'annual';
            } else {
                currentReportType = 'custom';
            }
        }

        const columns = [
            "ملاحظات", "التقييم", "أيام الحضور", "أجزاء المراجعة", "صفحات الحفظ", "التاريخ", "الحلقة", "الطالب"
        ];

        const rows = reports.map(report => ([
            report.notes,
            `${report.rating}/100`,
            report.attendanceDays,
            report.partsRevised,
            report.pagesMemorized,
            report.reportDateFormatted,
            report.halaqaName,
            report.studentName
        ]).reverse()); // نعكس ترتيب البيانات فقط، وليس الأعمدة

        // استدعاء دالة التصدير مع المعلمات الجديدة
        exportToPdf(
            currentReportType,    // نوع التقرير
            columns,
            rows,
            "WeeklyReports",
            teacherNameToExport,  // اسم المعلم
            monthName,            // اسم الشهر (إذا كان شهريًا)
            year                  // السنة (إذا كان شهريًا أو سنويًا)
        );
    };

    return (
        <div className="reports-page-container page-container">
            <h2 className="reports-title">التقارير والإحصائيات</h2>

            <div className="filters-section card">
                <h3>تصفية التقارير</h3>
                <div className="filters-grid">
                    <div className="form-group">
                        <label htmlFor="student-filter">الطالب:</label>
                        <select
                            id="student-filter"
                            value={selectedStudent}
                            onChange={(e) => setSelectedStudent(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">جميع الطلاب</option>
                            {students.map(student => (
                                <option key={student.id} value={student.id}>{student.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label htmlFor="halaqa-filter">الحلقة:</label>
                        <select
                            id="halaqa-filter"
                            value={selectedHalaqa}
                            onChange={(e) => setSelectedHalaqa(e.target.value)}
                            className="filter-select"
                        >
                            <option value="">جميع الحلقات</option>
                            {halaqat.map(halaqa => (
                                <option key={halaqa.id} value={halaqa.id}>{halaqa.name}</option>
                            ))}
                        </select>
                    </div>

                    {userRole === 'admin' && ( // عرض حقل تصفية المعلم للمدير فقط
                        <div className="form-group">
                            <label htmlFor="teacher-filter">المعلم:</label>
                            <select
                                id="teacher-filter"
                                value={selectedTeacher}
                                onChange={(e) => setSelectedTeacher(e.target.value)}
                                className="filter-select"
                            >
                                <option value="">جميع المعلمين</option>
                                {teachers.map(teacher => (
                                    <option key={teacher.id} value={teacher.id}>{teacher.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="form-group">
                        <label htmlFor="start-date-filter">من تاريخ:</label>
                        <input
                            type="date"
                            id="start-date-filter"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="filter-input"
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="end-date-filter">إلى تاريخ:</label>
                        <input
                            type="date"
                            id="end-date-filter"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="filter-input"
                        />
                    </div>
                </div>
                <button onClick={fetchReports} className="view-reports-button" disabled={loading}>
                    {loading ? "جاري التحميل..." : "عرض التقارير"}
                </button>
            </div>

            {loading && <p className="loading-message">جاري تحميل البيانات...</p>}
            {error && <p className="error-message">{error}</p>}

            {showReport && reports.length > 0 && (
                <>
                    <div className="report-charts-section card">
                        <h3>رسوم بيانية إحصائية للتقارير المحددة</h3>
                        {overallChartData ? (
                            <div className="chart-container">
                                <Bar data={overallChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        ) : (
                            <p className="no-chart-data">لا توجد بيانات كافية لإنشاء الرسم البياني الإجمالي.</p>
                        )}
                    </div>

                    {/* قسم الرسم البياني للمتوسطات الشهرية */}
                    <div className="monthly-average-chart-section card">
                        <h3>متوسط الأداء الشهري</h3>
                        {monthlyAverageChartData ? (
                            <div className="chart-container">
                                <Bar data={monthlyAverageChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                            </div>
                        ) : (
                            <p className="no-chart-data">لا توجد بيانات كافية لإنشاء رسم بياني للمتوسطات الشهرية.</p>
                        )}
                    </div>

                    <div className="report-table-section card">
                        <div className="table-header-actions">
                            <h3>التقارير التفصيلية</h3>
                            <button onClick={handleExportPdf} className="export-pdf-button">
                                تصدير إلى PDF
                            </button>
                        </div>
                        {reports.length > 0 ? (
                            <>
                                <div className="table-responsive">
                                    <table className="reports-table">
                                        <thead>
                                            <tr>
                                                <th>الطالب</th>
                                                <th>الحلقة</th>
                                                <th>المعلم</th>
                                                <th>التاريخ</th>
                                                <th>صفحات الحفظ</th>
                                                <th>أجزاء المراجعة</th>
                                                <th>أيام الحضور</th>
                                                <th>التقييم</th>
                                                <th>ملاحظات</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {reports.map((report) => (
                                                <tr key={report.id}>
                                                    <td>{report.studentName}</td>
                                                    <td>{report.halaqaName}</td>
                                                    <td>{report.teacherName}</td>
                                                    <td>{report.reportDateFormatted}</td>
                                                    <td>{report.pagesMemorized}</td>
                                                    <td>{report.partsRevised}</td>
                                                    <td>{report.attendanceDays}</td>
                                                    <td>{report.rating}/100</td>
                                                    <td>{report.notes}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <p className="no-data-message">لا توجد تقارير تفصيلية لعرضها بناءً على المعايير المحددة.</p>
                        )}
                    </div>
                </>
            )}

            {reports.length === 0 && !loading && !error && !showReport && (
                <p className="info-message">يرجى تحديد معايير التقرير والنقر على "عرض التقارير".</p>
            )}
        </div>
    );
}
