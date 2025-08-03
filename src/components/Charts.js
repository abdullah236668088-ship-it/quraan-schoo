import React, { useEffect, useState, useCallback } from "react";
import { Line } from "react-chartjs-2";
import { db } from "../firebaseConfig"; // لا حاجة لـ auth هنا
import { collection, query, where, getDocs } from "firebase/firestore";
import { useAuth } from "../contexts/AuthContext"; // استيراد useAuth

// Chart.js components registration (assuming this is handled globally or in index.js)
// If not already registered, you might need to add:
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);


import '../Styles/ChartsStyles.css'; // استيراد ملف التنسيقات الخارجي

export default function Charts() {
    const { userRole, currentUser } = useAuth(); // استيراد userRole و currentUser
    const [chartData, setChartData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(""); // إضافة حالة للخطأ

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(""); // مسح الأخطاء السابقة

        if (!currentUser || !currentUser.uid) { // التأكد من وجود currentUser و UID
            setChartData(null);
            setLoading(false);
            return;
        }

        let reportsQueryRef;
        // بناء الاستعلام بناءً على دور المستخدم
        // إذا كان معلمًا، يجلب تقارير الطلاب المرتبطين به فقط
        if (userRole === "teacher") {
            try {
                // جلب الطلاب المرتبطين بالمعلم أولاً
                const studentsQuery = query(collection(db, "students"), where("teacherId", "==", currentUser.uid));
                const studentsSnapshot = await getDocs(studentsQuery);
                const studentIds = studentsSnapshot.docs.map(doc => doc.id);

                if (studentIds.length === 0) {
                    setChartData(null);
                    setLoading(false);
                    return; // لا يوجد طلاب لهذا المعلم، لا توجد تقارير لجلبها
                }

                // جلب التقارير الأسبوعية لهؤلاء الطلاب
                // ملاحظة: Firestore لا يدعم استعلامات 'in' لأكثر من 10 عناصر.
                // إذا كان هناك عدد كبير من الطلاب، ستحتاج إلى تقسيم الاستعلامات أو إعادة التفكير في البنية.
                reportsQueryRef = query(collection(db, "weeklyReports"), where("studentId", "in", studentIds));

            } catch (err) {
                console.error("Error fetching teacher's students or reports:", err);
                setError("فشل في جلب تقارير الطلاب للمعلم: " + err.message);
                setLoading(false);
                return;
            }
        } else if (userRole === "admin") {
            // إذا كان مديرًا، يجلب جميع التقارير
            reportsQueryRef = collection(db, "weeklyReports");
        } else {
            // للأدوار الأخرى، لا توجد بيانات لعرضها
            setChartData(null);
            setLoading(false);
            return;
        }

        try {
            const querySnapshot = await getDocs(reportsQueryRef);
            const weeklyTotals = {};

            querySnapshot.forEach((doc) => {
                const report = doc.data();
                // استخدام تنسيق تاريخ بسيط كـ "YYYY-MM-DD" لتجميع البيانات أسبوعيًا
                // يمكن تحسين هذا ليعكس أسابيع فعلية (مثل رقم الأسبوع في السنة)
                const reportDate = new Date(report.reportDate.toDate()); // تحويل Timestamp إلى Date
                const year = reportDate.getFullYear();
                const month = (reportDate.getMonth() + 1).toString().padStart(2, '0');
                const day = reportDate.getDate().toString().padStart(2, '0');
                const week = `${year}-${month}-${day}`; // يمكن تعديل هذا ليكون أسبوعًا فعليًا

                if (!weeklyTotals[week]) {
                    weeklyTotals[week] = 0;
                }
                weeklyTotals[week] += report.pagesMemorized || 0;
            });

            // فرز التواريخ لضمان الترتيب الصحيح في الرسم البياني
            const labels = Object.keys(weeklyTotals).sort();
            const dataPoints = labels.map((label) => weeklyTotals[label]);

            if (labels.length > 0) {
                setChartData({
                    labels,
                    datasets: [
                        {
                            label: "عدد الصفحات المحفوظة",
                            data: dataPoints,
                            fill: false,
                            borderColor: "rgb(75, 192, 192)",
                            tension: 0.1,
                            pointBackgroundColor: "rgb(75, 192, 192)",
                            pointBorderColor: "#fff",
                            pointHoverBackgroundColor: "#fff",
                            pointHoverBorderColor: "rgb(75, 192, 192)",
                        },
                    ],
                });
            } else {
                setChartData(null); // لا توجد بيانات لعرضها
            }
        } catch (err) {
            console.error("Error processing chart data:", err);
            setError("فشل في معالجة بيانات الرسم البياني: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [userRole, currentUser]); // إضافة currentUser و userRole إلى dependencies

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    if (loading) return <p className="loading-message">جاري تحميل البيانات...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="charts-container page-container">
            <h2 className="charts-title">الرسوم البيانية لإنجاز الطلاب</h2>
            {chartData && chartData.labels.length > 0 ? (
                <div className="chart-container">
                    <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
                </div>
            ) : (
                <p className="no-chart-data">لا توجد بيانات لعرضها حاليًا. تأكد من وجود تقارير أسبوعية للطلاب.</p>
            )}
        </div>
    );
}
