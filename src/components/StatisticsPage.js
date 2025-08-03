// src/pages/StatisticsPage.js
import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext";
import { Pie, Bar } from "react-chartjs-2";
// Chart.js components registration (assuming this is handled globally or in Charts.js)
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

import '../Styles/StatisticsPageStyles.css'; // استيراد ملف التنسيقات الخارجي

export default function StatisticsPage() {
    const { userRole, currentUser } = useAuth();
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalHalaqat: 0,
        totalTeachers: 0,
        studentDistribution: {}, // توزيع الطلاب حسب الحلقة
        averageMemorization: 0,
        averageRevision: 0,
        averageAttendance: 0,
        halaqaNamesMap: {}, // لتخزين أسماء الحلقات لتسميات الرسوم البيانية
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // حالات جديدة لأفضل الطلاب والحلقات
    const [bestHalaqaOfMonth, setBestHalaqaOfMonth] = useState(null);
    const [bestStudentOfWeekOverall, setBestStudentOfWeekOverall] = useState(null);
    const [bestStudentOfWeekPerHalaqa, setBestStudentOfWeekPerHalaqa] = useState({});
    const [bestStudentOfMonthOverall, setBestStudentOfMonthOverall] = useState(null);
    const [bestStudentOfMonthPerHalaqa, setBestStudentOfMonthPerHalaqa] = useState({});

    /**
     * دالة مساعدة لحساب إحصائيات توزيع الطلاب.
     * @param {Array} studentsSnapshot - لقطة بيانات الطلاب من Firestore.
     * @param {Object} halaqaNamesMap - خريطة بأسماء الحلقات ومعرفاتها.
     * @returns {Object} كائن يمثل توزيع الطلاب حسب الحلقة.
     */
    const calculateStudentDistribution = (studentsSnapshot, halaqaNamesMap) => {
        const distribution = {};
        studentsSnapshot.forEach(doc => {
            const studentData = doc.data();
            const halaqaId = studentData.halaqaId;
            if (halaqaId && halaqaNamesMap[halaqaId]) {
                const halaqaName = halaqaNamesMap[halaqaId];
                distribution[halaqaName] = (distribution[halaqaName] || 0) + 1;
            }
        });
        return distribution;
    };

    /**
     * دالة مساعدة لحساب متوسطات الأداء من التقارير الأسبوعية.
     * @param {Array} weeklyReportsSnapshot - لقطة بيانات التقارير الأسبوعية من Firestore.
     * @returns {Object} كائن يحتوي على متوسطات الحفظ والمراجعة والحضور.
     */
    const calculateAveragePerformance = (weeklyReportsSnapshot) => {
        let totalMemorization = 0;
        let totalRevision = 0;
        let totalAttendance = 0;
        let reportCount = 0;

        weeklyReportsSnapshot.forEach(doc => {
            const reportData = doc.data();
            totalMemorization += reportData.pagesMemorized || 0;
            totalRevision += reportData.partsRevised || 0;
            totalAttendance += reportData.attendanceDays || 0;
            reportCount++;
        });

        const averageMemorization = reportCount > 0 ? (totalMemorization / reportCount).toFixed(2) : 0;
        const averageRevision = reportCount > 0 ? (totalRevision / reportCount).toFixed(2) : 0;
        const averageAttendance = reportCount > 0 ? (totalAttendance / reportCount).toFixed(2) : 0;

        return {
            averageMemorization: parseFloat(averageMemorization),
            averageRevision: parseFloat(averageRevision),
            averageAttendance: parseFloat(averageAttendance),
        };
    };

    /**
     * دالة مساعدة للحصول على بداية الأسبوع (الأحد) لتاريخ معين.
     * @param {Date} date - التاريخ.
     * @returns {Date} بداية الأسبوع.
     */
    const getStartOfWeek = (date) => {
        const d = new Date(date);
        const day = d.getDay(); // 0 for Sunday, 1 for Monday, etc.
        const diff = d.getDate() - day; // Adjust to Sunday
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    /**
     * دالة مساعدة للحصول على بداية الشهر لتاريخ معين.
     * @param {Date} date - التاريخ.
     * @returns {Date} بداية الشهر.
     */
    const getStartOfMonth = (date) => {
        const d = new Date(date);
        d.setDate(1);
        d.setHours(0, 0, 0, 0);
        return d;
    };

    /**
     * دالة لجلب الإحصائيات من Firestore بناءً على دور المستخدم.
     */
    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            let studentsQueryRef = collection(db, "students");
            let halaqatQueryRef = collection(db, "halaqat");
            let weeklyReportsQueryRef = collection(db, "weeklyReports");
            let usersQueryRef = collection(db, "users"); // لجلب جميع المستخدمين لتحديد المعلمين

            // جلب الحلقات أولاً للحصول على halaqatNamesMap مبكرًا
            const allHalaqatSnapshot = await getDocs(collection(db, "halaqat"));
            const halaqaNamesMap = {};
            allHalaqatSnapshot.forEach(doc => {
                halaqaNamesMap[doc.id] = doc.data().name;
            });

            // جلب الطلاب والمعلمين للحصول على أسمائهم
            const allStudentsSnapshot = await getDocs(collection(db, "students"));
            const studentsMap = {};
            allStudentsSnapshot.forEach(doc => {
                studentsMap[doc.id] = doc.data().name;
            });

            const allTeachersSnapshot = await getDocs(collection(db, "users"));
            const teachersMap = {};
            allTeachersSnapshot.docs.filter(doc => doc.data().role === 'teacher').forEach(doc => {
                teachersMap[doc.id] = doc.data().name || doc.data().email;
            });


            // تصفية الاستعلامات بناءً على دور المستخدم
            if (userRole === "teacher" && currentUser) {
                // جلب الحلقات المرتبطة بالمعلم
                const teacherHalaqatSnapshot = await getDocs(query(collection(db, "halaqat"), where("teacherId", "==", currentUser.uid)));
                const teacherHalaqaIds = teacherHalaqatSnapshot.docs.map(doc => doc.id);

                if (teacherHalaqaIds.length === 0) {
                    // إذا لم يكن للمعلم حلقات، فلا توجد إحصائيات لعرضها
                    setStats({
                        totalStudents: 0,
                        totalHalaqat: 0,
                        totalTeachers: 0,
                        studentDistribution: {},
                        averageMemorization: 0,
                        averageRevision: 0,
                        averageAttendance: 0,
                        halaqaNamesMap: {},
                    });
                    setBestHalaqaOfMonth(null);
                    setBestStudentOfWeekOverall(null);
                    setBestStudentOfWeekPerHalaqa({});
                    setBestStudentOfMonthOverall(null);
                    setBestStudentOfMonthPerHalaqa({});
                    setLoading(false);
                    return;
                }

                // تصفية الطلاب بناءً على الحلقات المرتبطة بالمعلم
                studentsQueryRef = query(studentsQueryRef, where("halaqaId", "in", teacherHalaqaIds));
                // تصفية التقارير الأسبوعية بناءً على الحلقات المرتبطة بالمعلم
                weeklyReportsQueryRef = query(weeklyReportsQueryRef, where("halaqaId", "in", teacherHalaqaIds));

                // تحديث halaqatNamesMap لتشمل فقط حلقات المعلم
                const teacherHalaqatNamesMap = {};
                teacherHalaqatSnapshot.forEach(doc => {
                    teacherHalaqatNamesMap[doc.id] = doc.data().name;
                });
                setStats(prev => ({ ...prev, halaqaNamesMap: teacherHalaqatNamesMap }));

            } else {
                // للمدير، استخدم الخريطة الكاملة للحلقات
                setStats(prev => ({ ...prev, halaqaNamesMap: halaqaNamesMap }));
            }

            // جلب البيانات بشكل متزامن
            const [
                studentsSnapshot,
                weeklyReportsSnapshot,
                usersSnapshotForTeachers // جلب المستخدمين لتحديد المعلمين
            ] = await Promise.all([
                getDocs(studentsQueryRef),
                getDocs(weeklyReportsQueryRef),
                getDocs(usersQueryRef)
            ]);

            const totalStudents = studentsSnapshot.size;
            const totalHalaqat = userRole === "teacher" ? studentsSnapshot.docs.reduce((acc, doc) => {
                const halaqaId = doc.data().halaqaId;
                if (halaqaId && !acc.includes(halaqaId)) {
                    acc.push(halaqaId);
                }
                return acc;
            }, []).length : allHalaqatSnapshot.size; // عدد الحلقات التي بها طلاب للمعلم، أو كل الحلقات للمدير

            const totalTeachers = usersSnapshotForTeachers.docs.filter(doc => doc.data().role === 'teacher').length;

            // حساب توزيع الطلاب
            const studentDistribution = calculateStudentDistribution(studentsSnapshot, halaqaNamesMap);

            // حساب متوسطات الأداء
            const { averageMemorization, averageRevision, averageAttendance } = calculateAveragePerformance(weeklyReportsSnapshot);

            // ===================================================================================
            // حساب أفضل الحلقات والطلاب
            // ===================================================================================
            const now = new Date();
            const startOfCurrentWeek = getStartOfWeek(now);
            const startOfCurrentMonth = getStartOfMonth(now);

            const weeklyStudentScores = {}; // { studentId: { score: X, halaqaId: Y } }
            const monthlyStudentScores = {}; // { studentId: { score: X, halaqaId: Y } }
            const monthlyHalaqaScores = {}; // { halaqaId: { score: X, count: Y } }

            weeklyReportsSnapshot.forEach(doc => {
                const report = doc.data();
                const reportDate = new Date(report.reportDate); // Assuming reportDate is in a parseable format

                // Ensure rating is a number
                const rating = parseFloat(report.rating) || 0;

                // Check for current week reports
                if (reportDate >= startOfCurrentWeek && reportDate <= now) {
                    if (!weeklyStudentScores[report.studentId] || rating > weeklyStudentScores[report.studentId].score) {
                        weeklyStudentScores[report.studentId] = { score: rating, halaqaId: report.halaqaId };
                    }
                }

                // Check for current month reports
                if (reportDate >= startOfCurrentMonth && reportDate <= now) {
                    // Student scores for the month
                    if (!monthlyStudentScores[report.studentId] || rating > monthlyStudentScores[report.studentId].score) {
                        monthlyStudentScores[report.studentId] = { score: rating, halaqaId: report.halaqaId };
                    }

                    // Halaqa scores for the month (sum of ratings for simplicity, can be average)
                    if (!monthlyHalaqaScores[report.halaqaId]) {
                        monthlyHalaqaScores[report.halaqaId] = { totalRating: 0, count: 0 };
                    }
                    monthlyHalaqaScores[report.halaqaId].totalRating += rating;
                    monthlyHalaqaScores[report.halaqaId].count++;
                }
            });

            // تحديد أفضل طالب في الأسبوع (على الجميع)
            let overallBestStudentOfWeek = null;
            let maxOverallWeeklyScore = -1;
            for (const studentId in weeklyStudentScores) {
                if (weeklyStudentScores[studentId].score > maxOverallWeeklyScore) {
                    maxOverallWeeklyScore = weeklyStudentScores[studentId].score;
                    overallBestStudentOfWeek = {
                        id: studentId,
                        name: studentsMap[studentId] || "غير معروف",
                        score: maxOverallWeeklyScore,
                        halaqaName: halaqaNamesMap[weeklyStudentScores[studentId].halaqaId] || "غير معروف"
                    };
                }
            }
            setBestStudentOfWeekOverall(overallBestStudentOfWeek);

            // تحديد أفضل طالب في الأسبوع لكل حلقة
            const perHalaqaBestStudentOfWeek = {};
            for (const studentId in weeklyStudentScores) {
                const { score, halaqaId } = weeklyStudentScores[studentId];
                if (!perHalaqaBestStudentOfWeek[halaqaId] || score > perHalaqaBestStudentOfWeek[halaqaId].score) {
                    perHalaqaBestStudentOfWeek[halaqaId] = {
                        id: studentId,
                        name: studentsMap[studentId] || "غير معروف",
                        score: score,
                        halaqaName: halaqaNamesMap[halaqaId] || "غير معروف"
                    };
                }
            }
            setBestStudentOfWeekPerHalaqa(perHalaqaBestStudentOfWeek);

            // تحديد أفضل طالب في الشهر (على الجميع)
            let overallBestStudentOfMonth = null;
            let maxOverallMonthlyScore = -1;
            for (const studentId in monthlyStudentScores) {
                if (monthlyStudentScores[studentId].score > maxOverallMonthlyScore) {
                    maxOverallMonthlyScore = monthlyStudentScores[studentId].score;
                    overallBestStudentOfMonth = {
                        id: studentId,
                        name: studentsMap[studentId] || "غير معروف",
                        score: maxOverallMonthlyScore,
                        halaqaName: halaqaNamesMap[monthlyStudentScores[studentId].halaqaId] || "غير معروف"
                    };
                }
            }
            setBestStudentOfMonthOverall(overallBestStudentOfMonth);

            // تحديد أفضل طالب في الشهر لكل حلقة
            const perHalaqaBestStudentOfMonth = {};
            for (const studentId in monthlyStudentScores) {
                const { score, halaqaId } = monthlyStudentScores[studentId];
                if (!perHalaqaBestStudentOfMonth[halaqaId] || score > perHalaqaBestStudentOfMonth[halaqaId].score) {
                    perHalaqaBestStudentOfMonth[halaqaId] = {
                        id: studentId,
                        name: studentsMap[studentId] || "غير معروف",
                        score: score,
                        halaqaName: halaqaNamesMap[halaqaId] || "غير معروف"
                    };
                }
            }
            setBestStudentOfMonthPerHalaqa(perHalaqaBestStudentOfMonth);

            // تحديد أفضل حلقة في الشهر
            let overallBestHalaqaOfMonth = null;
            let maxOverallHalaqaMonthlyScore = -1;
            for (const halaqaId in monthlyHalaqaScores) {
                const avgHalaqaRating = monthlyHalaqaScores[halaqaId].totalRating / monthlyHalaqaScores[halaqaId].count;
                if (avgHalaqaRating > maxOverallHalaqaMonthlyScore) {
                    maxOverallHalaqaMonthlyScore = avgHalaqaRating;
                    overallBestHalaqaOfMonth = {
                        id: halaqaId,
                        name: halaqaNamesMap[halaqaId] || "غير معروف",
                        averageRating: avgHalaqaRating.toFixed(2)
                    };
                }
            }
            setBestHalaqaOfMonth(overallBestHalaqaOfMonth);

            // ===================================================================================

            setStats(prevStats => ({
                ...prevStats,
                totalStudents,
                totalHalaqat,
                totalTeachers: userRole === "admin" ? totalTeachers : 0, // عرض المعلمين فقط للمدير
                studentDistribution,
                averageMemorization,
                averageRevision,
                averageAttendance,
            }));

        } catch (err) {
            console.error("Error fetching statistics:", err);
            setError("فشل في جلب الإحصائيات: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [userRole, currentUser]);

    useEffect(() => {
        // جلب الإحصائيات فقط إذا كان المستخدم مسؤولاً أو معلمًا
        if (userRole === "admin" || userRole === "teacher") {
            fetchStats();
        } else {
            setLoading(false);
            setError("ليس لديك الصلاحية لعرض هذه الإحصائيات.");
        }
    }, [userRole, fetchStats]);

    // بيانات الرسم البياني الدائري لتوزيع الطلاب
    const pieData = {
        labels: Object.keys(stats.studentDistribution),
        datasets: [
            {
                data: Object.values(stats.studentDistribution),
                backgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                    '#E7E9ED', '#8D6E63', '#C0CA33', '#7CB342'
                ],
                hoverBackgroundColor: [
                    '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40',
                    '#E7E9ED', '#8D6E63', '#C0CA33', '#7CB342'
                ],
            },
        ],
    };

    // بيانات الرسم البياني الشريطي لمتوسط الأداء
    const barData = {
        labels: ['متوسط الحفظ', 'متوسط المراجعة', 'متوسط الحضور'],
        datasets: [
            {
                label: 'المتوسط',
                data: [stats.averageMemorization, stats.averageRevision, stats.averageAttendance],
                backgroundColor: [
                    'rgba(75, 192, 192, 0.6)',
                    'rgba(153, 102, 255, 0.6)',
                    'rgba(255, 159, 64, 0.6)',
                ],
                borderColor: [
                    'rgba(75, 192, 192, 1)',
                    'rgba(153, 102, 255, 1)',
                    'rgba(255, 159, 64, 1)',
                ],
                borderWidth: 1,
            },
        ],
    };

    // عرض رسائل التحميل والخطأ والصلاحيات
    if (loading) return <p className="loading-message">جاري تحميل الإحصائيات...</p>;
    if (error) return <p className="error-message">{error}</p>;

    if (userRole !== "admin" && userRole !== "teacher") {
        return <p className="unauthorized-message">ليس لديك الصلاحية لعرض هذه الإحصائيات.</p>;
    }

    return (
        <div className="statistics-page-container page-container">
            <h2 className="statistics-page-title">الإحصائيات العامة</h2>
            <div className="stats-summary">
                <p>إجمالي الطلاب: <span className="stat-value">{stats.totalStudents}</span></p>
                <p>إجمالي الحلقات: <span className="stat-value">{stats.totalHalaqat}</span></p>
                {userRole === "admin" && <p>إجمالي المعلمين: <span className="stat-value">{stats.totalTeachers}</span></p>}
            </div>

            {/* قسم أفضل الحلقات والطلاب */}
            <div className="best-performers-section card">
                <h3 className="chart-title">أفضل الأداء</h3>

                {/* أفضل حلقة في الشهر */}
                <div className="best-item">
                    <h4>أفضل حلقة في الشهر الحالي:</h4>
                    {bestHalaqaOfMonth ? (
                        <p>
                            <span className="performer-name">{bestHalaqaOfMonth.name}</span> بمتوسط تقييم: <span className="performer-score">{bestHalaqaOfMonth.averageRating}/100</span>
                        </p>
                    ) : (
                        <p className="no-data-message-small">لا توجد بيانات لأفضل حلقة هذا الشهر.</p>
                    )}
                </div>

                {/* أفضل طالب في الأسبوع (على الجميع) */}
                <div className="best-item">
                    <h4>أفضل طالب في الأسبوع الحالي (على الجميع):</h4>
                    {bestStudentOfWeekOverall ? (
                        <p>
                            <span className="performer-name">{bestStudentOfWeekOverall.name}</span> من حلقة <span className="performer-halaqa">{bestStudentOfWeekOverall.halaqaName}</span> بتقييم: <span className="performer-score">{bestStudentOfWeekOverall.score}/100</span>
                        </p>
                    ) : (
                        <p className="no-data-message-small">لا توجد بيانات لأفضل طالب هذا الأسبوع.</p>
                    )}
                </div>

                {/* أفضل طالب في الأسبوع (لكل حلقة) */}
                <div className="best-item">
                    <h4>أفضل طالب في الأسبوع الحالي (لكل حلقة):</h4>
                    {Object.keys(bestStudentOfWeekPerHalaqa).length > 0 ? (
                        <ul>
                            {Object.values(bestStudentOfWeekPerHalaqa).map((student, index) => (
                                <li key={index}>
                                    <span className="performer-name">{student.name}</span> من حلقة <span className="performer-halaqa">{student.halaqaName}</span> بتقييم: <span className="performer-score">{student.score}/100</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-data-message-small">لا توجد بيانات لأفضل طالب في الأسبوع لكل حلقة.</p>
                    )}
                </div>

                {/* أفضل طالب في الشهر (على الجميع) */}
                <div className="best-item">
                    <h4>أفضل طالب في الشهر الحالي (على الجميع):</h4>
                    {bestStudentOfMonthOverall ? (
                        <p>
                            <span className="performer-name">{bestStudentOfMonthOverall.name}</span> من حلقة <span className="performer-halaqa">{bestStudentOfMonthOverall.halaqaName}</span> بتقييم: <span className="performer-score">{bestStudentOfMonthOverall.score}/100</span>
                        </p>
                    ) : (
                        <p className="no-data-message-small">لا توجد بيانات لأفضل طالب هذا الشهر.</p>
                    )}
                </div>

                {/* أفضل طالب في الشهر (لكل حلقة) */}
                <div className="best-item">
                    <h4>أفضل طالب في الشهر الحالي (لكل حلقة):</h4>
                    {Object.keys(bestStudentOfMonthPerHalaqa).length > 0 ? (
                        <ul>
                            {Object.values(bestStudentOfMonthPerHalaqa).map((student, index) => (
                                <li key={index}>
                                    <span className="performer-name">{student.name}</span> من حلقة <span className="performer-halaqa">{student.halaqaName}</span> بتقييم: <span className="performer-score">{student.score}/100</span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="no-data-message-small">لا توجد بيانات لأفضل طالب في الشهر لكل حلقة.</p>
                    )}
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-card">
                    <h3 className="chart-title">توزيع الطلاب حسب الحلقة</h3>
                    <div className="chart-container">
                        {Object.keys(stats.studentDistribution).length > 0 ? (
                            <Pie data={pieData} options={{ responsive: true, maintainAspectRatio: false }} />
                        ) : (
                            <p className="no-chart-data">لا توجد بيانات لتوزيع الطلاب.</p>
                        )}
                    </div>
                </div>
                <div className="chart-card">
                    <h3 className="chart-title">متوسط الحفظ، المراجعة، والحضور</h3>
                    <div className="chart-container">
                        {stats.averageMemorization > 0 || stats.averageRevision > 0 || stats.averageAttendance > 0 ? (
                            <Bar data={barData} options={{ responsive: true, maintainAspectRatio: false }} />
                        ) : (
                            <p className="no-chart-data">لا توجد بيانات لمتوسطات الأداء.</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
