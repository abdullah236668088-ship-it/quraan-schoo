import React, { useEffect, useState, useCallback } from "react";
import { db } from "../firebaseConfig";
import { collection, getDocs, getCountFromServer, getAggregateFromServer, sum, average } from "firebase/firestore";
import { exportToPdf } from '../utils/pdfExporter'; // 1. استيراد دالة التصدير
import { Pie, Bar } from "react-chartjs-2";
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
    Title
} from 'chart.js';
import { Link } from 'react-router-dom'; // استيراد Link من react-router-dom
import '../Styles/AdminDashboardStyles.css'; // استيراد ملف التنسيقات الخارجي

// Register Chart.js components required for Pie and Bar charts
// تسجيل مكونات Chart.js المطلوبة للرسوم البيانية الدائرية والشريطية
ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

export default function AdminDashboard() {
    const [stats, setStats] = useState({
        totalStudents: 0,
        totalHalaqat: 0,
        totalGuests: 0,
        totalAdmins: 0, // New: Total Admins
        totalUsers: 0, // New: Total Users
        upcomingActivities: 0,
        totalWeeklyReports: 0, // New: Total Weekly Reports
        averagePagesMemorized: 0, // New: Overall Average Pages Memorized
        averageAttendance: 0, // New: Overall Average Attendance
        studentDistributionByHalaqa: {}, // New: Student distribution by Halaqa
        userRoleDistribution: { labels: [], datasets: [] }, // New: User role distribution
        halaqaNamesMap: {}, // To store halaqa names for chart labels
    });
    const [users, setUsers] = useState([]); // حالة جديدة لتخزين قائمة المستخدمين
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            // --- Performance Improvement: Use Aggregation Queries ---
            // Fetch counts and aggregates directly from the server instead of all documents.
            // This drastically reduces the number of reads and improves performance.

            const studentsCol = collection(db, "students");
            const halaqatCol = collection(db, "halaqat");
            const usersCol = collection(db, "users");
            const activitiesCol = collection(db, "activities");
            const weeklyReportsCol = collection(db, "weeklyReports");

            // Correctly call Promise.all with all necessary queries
            // استدعاء Promise.all بشكل صحيح مع جميع الاستعلامات اللازمة
            const [
                studentsCount,
                halaqatCount,
                usersCount,
                weeklyReportsAggregate,
                usersSnapshot,
                activitiesSnapshot,
                halaqatSnapshot,
                studentsSnapshot
            ] = await Promise.all([
                getCountFromServer(studentsCol),
                getCountFromServer(halaqatCol),
                getCountFromServer(usersCol),
                getAggregateFromServer(weeklyReportsCol, {
                    count: 'count',
                    averagePagesMemorized: average('pagesMemorized'),
                    averageAttendance: average('attendanceDays')
                }),
                getDocs(usersCol), // Still need for role distribution
                getDocs(activitiesCol), // Still need to fetch docs to check dates
                getDocs(halaqatCol), // Still need for names map
                getDocs(studentsCol) // Still need for distribution
            ]);

            // 2. تخزين بيانات المستخدمين في الحالة لإعادة استخدامها
            const usersList = usersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setUsers(usersList);

            // Calculate user role distribution
            // حساب توزيع أدوار المستخدمين
            const userRoles = {};
            usersSnapshot.forEach(doc => {
                const role = doc.data().role;
                userRoles[role] = (userRoles[role] || 0) + 1;
            });

            const userRoleDistributionData = {
                labels: Object.keys(userRoles).map(role => {
                    // Translate role keys to Arabic for better display
                    if (role === 'admin') return 'مدير';
                    if (role === 'teacher') return 'معلم';
                    if (role === 'guest') return 'ضيف';
                    return role;
                }),
                datasets: [{
                    data: Object.values(userRoles),
                    backgroundColor: [
                        'rgba(255, 99, 132, 0.6)', // Admin
                        'rgba(54, 162, 235, 0.6)', // Teacher
                        'rgba(255, 206, 86, 0.6)', // Guest
                    ],
                    borderColor: [
                        'rgba(255, 99, 132, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                    ],
                    borderWidth: 1,
                }]
            };

            // Create a map of Halaqa IDs to names for the chart
            // إنشاء خريطة لأسماء الحلقات لاستخدامها في الرسم البياني
            const halaqaNamesMap = {};
            halaqatSnapshot.forEach(doc => {
                halaqaNamesMap[doc.id] = doc.data().name;
            });

            // Calculate student distribution by Halaqa using the map
            // حساب توزيع الطلاب حسب الحلقة باستخدام الخريطة
            const studentDistribution = {};
            studentsSnapshot.forEach(doc => {
                const studentData = doc.data();
                const halaqaId = studentData.halaqaId;
                if (halaqaId && halaqaNamesMap[halaqaId]) {
                    const halaqaName = halaqaNamesMap[halaqaId];
                    studentDistribution[halaqaName] = (studentDistribution[halaqaName] || 0) + 1;
                }
            });

            // Filter upcoming activities from the fetched activitiesSnapshot
            // تصفية الأنشطة القادمة من البيانات التي تم جلبها
            const now = new Date();
            let upcomingActivitiesCount = 0;
            activitiesSnapshot.forEach(doc => {
                const activityDateStr = doc.data().date;
                const activityTimeStr = doc.data().time;
                if (activityDateStr && activityTimeStr) {
                    const activityDate = new Date(`${activityDateStr}T${activityTimeStr}`);
                    if (activityDate > now) {
                        upcomingActivitiesCount++;
                    }
                }
            });

            setStats({
                totalStudents: studentsCount.data().count,
                totalHalaqat: halaqatCount.data().count,
                totalTeachers: userRoles['teacher'] || 0, // تم الاشتقاق من مجموعة المستخدمين للاتساق
                totalGuests: userRoles['guest'] || 0,
                totalAdmins: userRoles['admin'] || 0,
                totalUsers: usersCount.data().count,
                upcomingActivities: upcomingActivitiesCount,
                totalWeeklyReports: weeklyReportsAggregate.data().count,
                // Use .data() to access aggregate results and handle potential null/undefined values
                averagePagesMemorized: parseFloat(weeklyReportsAggregate.data().averagePagesMemorized?.toFixed(2) || 0),
                averageAttendance: parseFloat(weeklyReportsAggregate.data().averageAttendance?.toFixed(2) || 0),
                studentDistributionByHalaqa: studentDistribution,
                userRoleDistribution: userRoleDistributionData,
                halaqaNamesMap,
            });

        } catch (err) {
            console.error("Error fetching dashboard stats:", err);
            setError("فشل في جلب إحصائيات لوحة التحكم: " + err.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    // 3. دالة جديدة لتصدير المستخدمين
    const exportUsersPdf = useCallback(() => {
        if (users.length === 0) {
            alert("لا يوجد مستخدمون لتصديرهم.");
            return;
        }
        const title = "تقرير بيانات المستخدمين";
        const columns = ["البريد الإلكتروني", "الدور", "تاريخ الإنشاء"];
        const rows = users.map(user => [user.email, user.role || 'غير محدد', user.createdAt?.toDate().toLocaleDateString('ar-EG') || 'غير محدد']);
        exportToPdf(title, columns, rows, "تقرير_المستخدمين");
    }, [users]);

    // Data for Student Distribution by Halaqa Chart
    // بيانات الرسم البياني لتوزيع الطلاب حسب الحلقة
    const studentDistributionChartData = {
        labels: Object.keys(stats.studentDistributionByHalaqa),
        datasets: [
            {
                data: Object.values(stats.studentDistributionByHalaqa),
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

    if (loading) {
        return <p className="loading-message">جاري تحميل لوحة تحكم المدير...</p>;
    }

    if (error) {
        return <p className="error-message">{error}</p>;
    }

    return (
        <div className="admin-dashboard-container page-container">
            <h2 className="admin-dashboard-title">لوحة تحكم المدير</h2>

            <div className="stats-summary-grid">
                <div className="stat-card">
                    <h3>إجمالي الطلاب</h3>
                    <p>{stats.totalStudents}</p>
                </div>
                <div className="stat-card">
                    <h3>إجمالي الحلقات</h3>
                    <p>{stats.totalHalaqat}</p>
                </div>
                <div className="stat-card">
                    <h3>إجمالي المعلمين</h3>
                    <p>{stats.totalTeachers}</p>
                </div>
                <div className="stat-card">
                    <h3>إجمالي المستخدمين</h3>
                    <p>{stats.totalUsers}</p>
                </div>
                <div className="stat-card">
                    <h3>أنشطة قادمة</h3>
                    <p>{stats.upcomingActivities}</p>
                </div>
                <div className="stat-card">
                    <h3>متوسط الصفحات المحفوظة (لكل تقرير)</h3>
                    <p>{stats.averagePagesMemorized}</p>
                </div>
                <div className="stat-card">
                    <h3>متوسط أيام الحضور (لكل تقرير)</h3>
                    <p>{stats.averageAttendance}</p>
                </div>
            </div>

            {/* تم تغيير اسم الفئة من charts-section إلى charts-grid لمطابقة ملف CSS */}
            <div className="charts-grid">
                <div className="chart-card">
                    <h3>توزيع الطلاب حسب الحلقة</h3>
                    {/* تم إضافة حاوية ذات ارتفاع ثابت لمنع الخطأ */}
                    <div className="chart-container">
                        {Object.keys(stats.studentDistributionByHalaqa).length > 0 ? (
                            <Pie data={studentDistributionChartData} options={{ responsive: true, maintainAspectRatio: false }} />
                        ) : (
                            <p className="no-chart-data">لا توجد بيانات لتوزيع الطلاب حسب الحلقة.</p>
                        )}
                    </div>
                </div>
                <div className="chart-card">
                    <h3>توزيع أدوار المستخدمين</h3>
                    <div className="chart-container">
                        {stats.userRoleDistribution.labels.length > 0 ? (
                            <Pie data={stats.userRoleDistribution} options={{ responsive: true, maintainAspectRatio: false }} />
                        ) : (
                            <p className="no-chart-data">لا توجد بيانات لتوزيع المستخدمين.</p>
                        )}
                    </div>
                </div>
            </div>

            <div className="quick-links-section">
                <h3 className="quick-links-title">روابط سريعة</h3>
                <ul className="quick-links-list">
                    <li><Link to="/users" className="quick-link-item">إدارة المستخدمين</Link></li>
                    <li><Link to="/halaqat" className="quick-link-item">إدارة الحلقات</Link></li>
                    <li><Link to="/students" className="quick-link-item">إدارة الطلاب</Link></li>
                    <li><Link to="/teachers" className="quick-link-item">إدارة المعلمين</Link></li>
                    <li><Link to="/activities" className="quick-link-item">إدارة الأنشطة</Link></li>
                    <li><Link to="/reports" className="quick-link-item">التقارير والإحصائيات</Link></li>
                    <li><Link to="/weekly-reports" className="quick-link-item">إضافة تقرير أسبوعي</Link></li>
                    <li><Link to="/charts" className="quick-link-item">الرسوم البيانية العامة</Link></li>
                    {/* 4. إضافة زر تصدير المستخدمين */}
                    <li><button onClick={exportUsersPdf} className="quick-link-item button-as-link">
                        تصدير قائمة المستخدمين (PDF)
                    </button></li>
                    <li><Link to="/statistics" className="quick-link-item">صفحة الإحصائيات</Link></li> {/* رابط جديد لصفحة الإحصائيات */}
                    <li><Link to="/student-search-guest" className="quick-link-item">بحث الطالب (للضيوف)</Link></li>
                </ul>
            </div>
        </div>
    );
}
