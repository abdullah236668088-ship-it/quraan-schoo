// src/components/HomePage.js
import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom'; // استيراد Link
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebaseConfig'; // استيراد db
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore'; // استيراد onSnapshot و query و orderBy و limit
import '../Styles/HomePage.css'; // استيراد ملف التنسيقات

export default function HomePage() {
    const { currentUser, userRole, loading: authLoading } = useAuth();
    const [activities, setActivities] = useState([]);
    const [loadingActivities, setLoadingActivities] = useState(true);
    const [activitiesError, setActivitiesError] = useState('');

    // جلب الأنشطة في الوقت الفعلي من Firestore
    useEffect(() => {
        setLoadingActivities(true);
        setActivitiesError('');

        // إنشاء استعلام لجلب الأنشطة، مرتبة حسب التاريخ والوقت تنازليًا (الأحدث أولاً)
        // يمكن تعديل هذا الاستعلام لجلب عدد محدود من الأنشطة إذا كان هناك الكثير
        const activitiesQuery = query(
            collection(db, "activities"),
            orderBy("date", "desc"), // جلب الأحدث أولاً
            limit(6) // تحديد عدد الأنشطة التي ستظهر في الصفحة الرئيسية
        );

        // إعداد مستمع في الوقت الفعلي (onSnapshot)
        const unsubscribe = onSnapshot(activitiesQuery,
            (snapshot) => {
                const activitiesList = [];
                snapshot.forEach((doc) => {
                    activitiesList.push({ id: doc.id, ...doc.data() });
                });
                setActivities(activitiesList);
                setLoadingActivities(false);
            },
            (error) => {
                console.error("Error fetching real-time activities:", error);
                setActivitiesError("فشل في جلب الأنشطة: " + error.message);
                setLoadingActivities(false);
            }
        );

        // تنظيف المستمع عند إلغاء تحميل المكون
        return () => unsubscribe();
    }, []); // يعتمد على db فقط، لذا يتم تشغيله مرة واحدة عند تحميل المكون

    if (authLoading) {
        return <div className="loading-message">جاري تحميل الصفحة الرئيسية...</div>;
    }

    return (
        <div className="home-page-container">
            <h2 className="home-page-title">مرحباً بك في نظام متابعة حفظ القرآن الكريم</h2>

            {currentUser ? (
                <p className="welcome-message">
                    أهلاً بك يا {currentUser.displayName || currentUser.email}، دورك الحالي هو: <span className="user-role-highlight">{userRole}</span>.
                </p>
            ) : (
                <p className="welcome-message">
                    يرجى تسجيل الدخول أو التسجيل للوصول إلى ميزات النظام.
                </p>
            )}

            <section className="activities-section">
                <h3 className="section-title">أحدث الأنشطة والفعاليات</h3>
                {loadingActivities ? (
                    <p className="loading-message">جاري تحميل الأنشطة...</p>
                ) : activitiesError ? (
                    <p className="error-message">{activitiesError}</p>
                ) : activities.length === 0 ? (
                    <p className="no-data-message">لا توجد أنشطة أو فعاليات حاليًا. ترقبوا الجديد!</p>
                ) : (
                    <div className="activities-grid">
                        {activities.map((activity) => (
                            <div key={activity.id} className="activity-card">
                                {activity.imageUrl ? (
                                    <img
                                        src={activity.imageUrl}
                                        alt={activity.name}
                                        className="activity-image"
                                        onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x200/F0F0F0/333333?text=No+Image"; }}
                                    />
                                ) : (
                                    <div className="activity-image-placeholder">
                                        <span className="placeholder-text">لا توجد صورة</span>
                                    </div>
                                )}
                                <h4 className="activity-title">{activity.name}</h4>
                                <p className="activity-description">{activity.description}</p>
                                <div className="activity-details">
                                    <p><strong>التاريخ:</strong> {activity.date}</p>
                                    <p><strong>الوقت:</strong> {activity.time}</p>
                                    <p><strong>الموقع:</strong> {activity.location}</p>
                                </div>
                                {/* يمكنك إضافة زر "عرض التفاصيل" إذا كان هناك صفحة تفاصيل للنشاط */}
                                {/* <a href={`/activities/${activity.id}`} className="view-details-button">عرض التفاصيل</a> */}
                            </div>
                        ))}
                        {/* إضافة رابط "عرض الكل" إذا كان هناك أنشطة */}
                        {activities.length > 0 && (
                            <div className="view-all-container">
                                <Link to="/all-activities" className="view-all-link">عرض كل الأنشطة</Link>
                            </div>
                        )}
                    </div>
                )}
            </section>

            <section className="about-section">
                <h3 className="section-title">عن نظامنا</h3>
                <p className="about-text">
                    نظام متابعة حفظ القرآن الكريم هو أداة شاملة لمساعدة الطلاب والمعلمين وأولياء الأمور على تتبع التقدم في حفظ ومراجعة القرآن الكريم. يوفر النظام لوحات تحكم مخصصة لكل دور، وتقارير مفصلة، وإدارة سهلة للحلقات والطلاب.
                </p>
                <p className="about-text">
                    يهدف نظامنا إلى تبسيط عملية المتابعة وتحفيز الطلاب على الاستمرار في رحلتهم مع القرآن الكريم، مع توفير رؤى قيمة للمعلمين وأولياء الأمور حول أداء الطلاب.
                </p>
            </section>
        </div>
    );
}
