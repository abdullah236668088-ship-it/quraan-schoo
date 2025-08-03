import React, { useState, useCallback, useReducer } from "react";
import { db } from "../firebaseConfig";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import '../Styles/StudentSearchGuestStyles.css'; // استيراد ملف التنسيقات الخارجي
import { Bar, Line } from "react-chartjs-2";
import {
    Chart as ChartJS, // إعادة تسمية لتجنب التعارض
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
import CustomModal from './CustomModal'; // افتراض وجود مودال للرسائل

// تسجيل مكونات Chart.js اللازمة
ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

// الحالة الأولية للمكون عند استخدام useReducer
const initialState = {
    loading: false,
    error: "",
    message: "",
    student: null,
    allReports: [],
    lastWeekReport: null,
    lastMonthStats: null,
    lastWeekChartData: null,
    lastMonthChartData: null,
    motivationalMessage: "",
};

// Reducer لإدارة حالة البحث المعقدة
function searchReducer(state, action) {
    switch (action.type) {
        case 'SEARCH_START':
            return { ...initialState, loading: true };
        case 'SEARCH_SUCCESS':
            return { ...state, loading: false, ...action.payload };
        case 'SEARCH_FAILURE':
            return { ...initialState, loading: false, error: action.payload };
        case 'SEARCH_NOT_FOUND':
            return { ...initialState, loading: false, message: action.payload };
        case 'CLEAR_SEARCH':
            return { ...initialState };
        default:
            return state;
    }
}

export default function StudentSearchGuest() {
    const [searchTerm, setSearchTerm] = useState("");
    const [state, dispatch] = useReducer(searchReducer, initialState);
    const {
        loading, error, message, student, allReports, lastWeekReport,
        lastMonthStats, lastWeekChartData, lastMonthChartData, motivationalMessage
    } = state;

    // دالة لحساب الرسائل التحفيزية بناءً على الأداء
    // لا تغييرات هنا، الكود جيد
    const getMotivationalMessage = useCallback((stats) => {
        if (!stats) return "لا توجد بيانات كافية لتقديم رسالة تحفيزية.";

        const { averageRating, totalPagesMemorized, totalPartsRevised } = stats;

        if (averageRating >= 90 && totalPagesMemorized > 0) {
            return "ما شاء الله! أداء ممتاز ومجهود رائع في الحفظ والمراجعة. استمر في هذا المستوى المتميز!";
        } else if (averageRating >= 75 && totalPagesMemorized > 0) {
            return "أداء جيد جدًا! تقدم ملحوظ في الحفظ والمراجعة. حافظ على هذا الزخم وستصل إلى مستويات أعلى.";
        } else if (averageRating >= 50 && totalPagesMemorized > 0) {
            return "تقدم جيد. استمر في العمل الجاد وركز على مراجعة ما حفظته لترسيخه بشكل أفضل.";
        } else {
            return "ابدأ بخطوات صغيرة وثابتة. كل صفحة وكل آية تحفظها هي إنجاز عظيم. نحن هنا لدعمك!";
        }
    }, []);

    // دالة لحساب إحصائيات آخر شهر وتهيئة بيانات الرسم البياني الشهري
    const calculateLastMonthStats = useCallback((reports) => {
        const now = new Date();
        // طريقة أكثر دقة لحساب تاريخ "قبل شهر"
        const oneMonthAgo = new Date(now);
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        // معالجة الحالات الطرفية (مثل 31 مارس -> 3 مارس بدلاً من 31 فبراير)
        if (oneMonthAgo.getDate() !== now.getDate()) {
            oneMonthAgo.setDate(0); // الانتقال إلى آخر يوم في الشهر السابق
        }

        // تصفية التقارير التي تقع ضمن آخر شهر
        const monthlyReports = reports.filter(report => {
            const reportDate = report.reportDate?.toDate ? report.reportDate.toDate() : new Date(report.reportDate);
            return reportDate >= oneMonthAgo && reportDate <= now;
        });

        if (monthlyReports.length === 0) return null;

        let totalPagesMemorized = 0;
        let totalPartsRevised = 0;
        let totalAttendanceDays = 0;
        let totalRating = 0;
        let ratingCount = 0;

        monthlyReports.forEach(report => {
            totalPagesMemorized += report.pagesMemorized || 0;
            totalPartsRevised += report.partsRevised || 0;
            totalAttendanceDays += report.attendanceDays || 0;
            if (report.rating !== undefined && report.rating !== null) {
                totalRating += report.rating;
                ratingCount++;
            }
        });

        const averageRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(2) : 0;

        // طريقة أكثر دقة لتجميع البيانات أسبوعيًا
        const getStartOfWeek = (date) => {
            const d = new Date(date);
            const day = d.getDay(); // 0 = Sunday
            const diff = d.getDate() - day;
            return new Date(d.setDate(diff));
        };

        const weeklyMemorization = {}; // { 'YYYY-MM-DD': totalPages }
        monthlyReports.forEach(report => {
            const reportDate = report.reportDate.toDate();
            const weekKey = getStartOfWeek(reportDate).toISOString().split('T')[0];
            weeklyMemorization[weekKey] = (weeklyMemorization[weekKey] || 0) + (report.pagesMemorized || 0);
        });

        const sortedWeeks = Object.keys(weeklyMemorization).sort();
        // عرض التاريخ بشكل أوضح في الرسم البياني
        const chartLabels = sortedWeeks.map(weekKey => new Date(weekKey).toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' }));
        const chartDataPoints = sortedWeeks.map(week => weeklyMemorization[week]);

        const newLastMonthChartData = {
            labels: chartLabels,
            datasets: [
                {
                    label: 'الصفحات المحفوظة (شهريًا)',
                    data: chartDataPoints,
                    backgroundColor: 'rgba(75, 192, 192, 0.6)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    tension: 0.3, // لجعل الخط منحنيًا قليلاً
                    pointBackgroundColor: 'rgba(75, 192, 192, 1)',
                    pointBorderColor: '#fff',
                    pointHoverBackgroundColor: '#fff',
                    pointHoverBorderColor: 'rgba(75, 192, 192, 1)',
                },
            ],
        };

        return {
            totalPagesMemorized,
            totalPartsRevised,
            totalAttendanceDays,
            averageRating: parseFloat(averageRating),
            lastMonthChartData: newLastMonthChartData,
        };
    }, []);

    // دالة لمعالجة البحث عن الطالب
    const handleSearch = useCallback(async (e) => {
        e.preventDefault();
        dispatch({ type: 'SEARCH_START' });

        if (!searchTerm.trim()) {
            dispatch({ type: 'SEARCH_FAILURE', payload: "يرجى إدخال اسم الطالب للبحث." });
            return;
        }

        try {
            // 1. البحث عن الطالب بالاسم
            const studentsQuery = query(collection(db, "students"), where("name", "==", searchTerm.trim()));
            const studentsSnapshot = await getDocs(studentsQuery);

            if (studentsSnapshot.empty) {
                dispatch({ type: 'SEARCH_NOT_FOUND', payload: "لم يتم العثور على طالب بهذا الاسم." });
                return;
            }

            // تم العثور على الطالب
            const foundStudentData = studentsSnapshot.docs[0].data();
            const foundStudentId = studentsSnapshot.docs[0].id;
            let foundStudent = { id: foundStudentId, ...foundStudentData };

            // 2. جلب اسم الحلقة المرتبطة بالطالب
            if (foundStudent.halaqaId) {
                const halaqaDocRef = doc(db, "halaqat", foundStudent.halaqaId);
                const halaqaDocSnap = await getDoc(halaqaDocRef);
                if (halaqaDocSnap.exists()) {
                    foundStudent.halaqaName = halaqaDocSnap.data().name;
                } else {
                    foundStudent.halaqaName = "غير محددة"; // في حال عدم العثور على الحلقة
                }
            } else {
                foundStudent.halaqaName = "غير محددة"; // إذا لم يكن هناك halaqaId
            }

            // 3. جلب تقارير الطالب الأسبوعية
            const reportsQuery = query(
                collection(db, "weeklyReports"),
                where("studentId", "==", foundStudent.id),
                orderBy("reportDate", "desc") // ترتيب تنازلي للحصول على الأحدث أولاً
            );
            const reportsSnapshot = await getDocs(reportsQuery);
            const allReports = reportsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // 4. معالجة آخر تقرير أسبوعي
            let lastWeekReport = null, lastWeekChartData = null;
            if (allReports.length > 0) {
                lastWeekReport = allReports[0];

                // تهيئة بيانات الرسم البياني لآخر أسبوع (رسم بياني شريطي)
                lastWeekChartData = {
                    labels: ['صفحات محفوطة', 'أجزاء مراجعة', 'أيام حضور', 'تقييم'],
                    datasets: [
                        {
                            label: 'التقرير الأسبوعي الأخير',
                            data: [
                                latestReport.pagesMemorized || 0,
                                latestReport.partsRevised || 0,
                                latestReport.attendanceDays || 0,
                                latestReport.rating || 0
                            ],
                            backgroundColor: [
                                'rgba(255, 99, 132, 0.6)', // أحمر
                                'rgba(54, 162, 235, 0.6)', // أزرق
                                'rgba(255, 206, 86, 0.6)', // أصفر
                                'rgba(75, 192, 192, 0.6)', // أخضر
                            ],
                            borderColor: [
                                'rgba(255, 99, 132, 1)',
                                'rgba(54, 162, 235, 1)',
                                'rgba(255, 206, 86, 1)',
                                'rgba(75, 192, 192, 1)',
                            ],
                            borderWidth: 1,
                        },
                    ],
                };
            }

            // 5. حساب إحصائيات آخر شهر والرسالة التحفيزية
            const statsResult = calculateLastMonthStats(allReports);

            dispatch({
                type: 'SEARCH_SUCCESS',
                payload: {
                    student: foundStudent,
                    allReports,
                    lastWeekReport,
                    lastWeekChartData,
                    lastMonthStats: statsResult,
                    lastMonthChartData: statsResult ? statsResult.lastMonthChartData : null,
                    motivationalMessage: getMotivationalMessage(statsResult),
                }
            });

        } catch (err) {
            console.error("Error searching student:", err);
            dispatch({ type: 'SEARCH_FAILURE', payload: "حدث خطأ أثناء البحث عن الطالب: " + err.message });
        }
    }, [searchTerm, calculateLastMonthStats, getMotivationalMessage]); // dispatch is stable

    return (
        <div className="student-search-guest-container page-container">
            <h2 className="student-search-guest-title">بحث عن طالب</h2>

            <form onSubmit={handleSearch} className="search-form">
                <input
                    type="text"
                    placeholder="أدخل اسم الطالب للبحث..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="search-input"
                    disabled={loading}
                />
                <button type="submit" className="search-button" disabled={loading}>
                    {loading ? "جاري البحث..." : "بحث"}
                </button>
            </form>

            {error && <p className="error-message">{error}</p>}
            {message && <p className="info-message">{message}</p>}

            {student && !loading && (
                <div className="student-details-section card">
                    <h3>بيانات الطالب: {student.name}</h3>
                    <p><strong>الحلقة:</strong> {student.halaqaName || 'غير محددة'}</p> {/* سيتم عرض اسم الحلقة هنا */}
                    <p><strong>الجنس:</strong> {student.gender}</p>
                    <p><strong>الحفظ الحالي:</strong> {student.memorization || 'لا يوجد'}</p>
                    <p className="motivational-message">{motivationalMessage}</p>

                    {lastWeekReport && (
                        <div className="last-week-report-card">
                            <h4>آخر تقرير أسبوعي ({new Date(lastWeekReport.reportDate.toDate()).toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' })})</h4>
                            <div className="report-stats-grid">
                                <div className="stat-item">
                                    <h5>صفحات محفوطة</h5>
                                    <p>{lastWeekReport.pagesMemorized || 0}</p>
                                </div>
                                <div className="stat-item">
                                    <h5>أجزاء مراجعة</h5>
                                    <p>{lastWeekReport.partsRevised || 0}</p>
                                </div>
                                <div className="stat-item">
                                    <h5>أيام حضور</h5>
                                    <p>{lastWeekReport.attendanceDays || 0}</p>
                                </div>
                                <div className="stat-item">
                                    <h5>التقييم</h5>
                                    <p>{lastWeekReport.rating || 0}/100</p>
                                </div>
                            </div>
                            {lastWeekChartData && (
                                <div className="chart-container">
                                    <Bar data={lastWeekChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                                </div>
                            )}
                            <p className="report-notes"><strong>ملاحظات:</strong> {lastWeekReport.notes || 'لا توجد ملاحظات.'}</p>
                        </div>
                    )}

                    {lastMonthStats && (
                        <div className="last-month-stats-card">
                            <h4>إحصائيات آخر شهر</h4>
                            <div className="stat-cards-grid">
                                <div className="stat-card">
                                    <h5>إجمالي الحفظ</h5>
                                    <p>{lastMonthStats.totalPagesMemorized}</p>
                                </div>
                                <div className="stat-card">
                                    <h5>إجمالي المراجعة</h5>
                                    <p>{lastMonthStats.totalPartsRevised}</p>
                                </div>
                                <div className="stat-card">
                                    <h5>إجمالي الحضور</h5>
                                    <p>{lastMonthStats.totalAttendanceDays}</p>
                                </div>
                                <div className="stat-card">
                                    <h5>متوسط التقييم</h5>
                                    <p>{lastMonthStats.averageRating}/100</p>
                                </div>
                            </div>
                            {lastMonthChartData && (
                                <div className="chart-container">
                                    <Line data={lastMonthChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                                </div>
                            )}
                        </div>
                    )}

                    {allReports.length > 1 && (
                        <div className="previous-reports-section card">
                            <h4>التقارير السابقة</h4>
                            <div className="table-responsive">
                                <table className="reports-table">
                                    <thead>
                                        <tr>
                                            <th>التاريخ</th>
                                            <th>صفحات الحفظ</th>
                                            <th>أجزاء المراجعة</th>
                                            <th>أيام الحضور</th>
                                            <th>التقييم</th>
                                            <th>ملاحظات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {allReports.slice(1).map(report => ( // slice(1) to skip the latest report already shown
                                            <tr key={report.id}>
                                                <td>{new Date(report.reportDate.toDate()).toLocaleDateString('ar-EG')}</td>
                                                <td>{report.pagesMemorized || 0}</td>
                                                <td>{report.partsRevised || 0}</td>
                                                <td>{report.attendanceDays || 0}</td>
                                                <td>{report.rating || 0}/100</td>
                                                <td>{report.notes || 'لا يوجد'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {!lastWeekReport && !lastMonthStats && (
                        <p className="info-message">لا توجد بيانات تقارير مفصلة لهذا الطالب بعد.</p>
                    )}
                </div>
            )}
        </div>
    );
}
