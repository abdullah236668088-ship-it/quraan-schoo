// src/pages/AdvertisementsPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import '../Styles/AdvertisementsPageStyles.css'; // استيراد ملف التنسيقات الخاص بالصفحة

export default function AdvertisementsPage() {
    // حالة لتخزين الإعلانات
    const [advertisements, setAdvertisements] = useState([]);
    // حالة التحميل
    const [loading, setLoading] = useState(true);
    // حالة الخطأ
    const [error, setError] = useState('');
    // لتتبع آخر مستند تم عرضه لخاصية "المزيد" (pagination)
    const [lastVisible, setLastVisible] = useState(null);
    // لتحديد ما إذا كانت هناك المزيد من الإعلانات لجلبها
    const [hasMore, setHasMore] = useState(true);

    // عدد الإعلانات التي يتم جلبها في كل مرة عند النقر على "المزيد"
    const FETCH_LIMIT = 3;

    /**
     * دالة لجلب الإعلانات من Firestore.
     * @param {boolean} initialLoad - لتحديد ما إذا كان هذا هو التحميل الأولي للصفحة.
     */
    const fetchAdvertisements = useCallback(async (initialLoad = true) => {
        setLoading(true);
        setError('');

        try {
            let q;
            if (initialLoad) {
                // الاستعلام الأولي: يجلب أول FETCH_LIMIT من الإعلانات
                q = query(
                    collection(db, "advertisements"),
                    orderBy("date", "desc"), // ترتيب حسب التاريخ تنازلياً (الأحدث أولاً)
                    limit(FETCH_LIMIT)
                );
            } else {
                // الاستعلام لـ "المزيد": يجلب FETCH_LIMIT إعلانًا بعد آخر إعلان مرئي
                q = query(
                    collection(db, "advertisements"),
                    orderBy("date", "desc"),
                    startAfter(lastVisible), // يبدأ من بعد آخر مستند تم جلبه
                    limit(FETCH_LIMIT)
                );
            }

            const documentSnapshots = await getDocs(q);
            const newAdvertisements = documentSnapshots.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // تحديث حالة lastVisible لآخر مستند تم جلبه، لاستخدامه في التحميل التالي
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);

            // التحقق مما إذا كانت هناك المزيد من الإعلانات: إذا كان عدد الإعلانات التي تم جلبها أقل من FETCH_LIMIT، فهذا يعني أنه لا توجد المزيد.
            setHasMore(newAdvertisements.length === FETCH_LIMIT);

            if (initialLoad) {
                setAdvertisements(newAdvertisements);
            } else {
                // إضافة الإعلانات الجديدة إلى القائمة الموجودة
                setAdvertisements(prevAds => [...prevAds, ...newAdvertisements]);
            }

        } catch (err) {
            console.error("Error fetching advertisements:", err);
            setError("فشل في جلب الإعلانات: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [lastVisible]); // تعتمد على lastVisible لإعادة الجلب عند تغييرها

    // جلب الإعلانات عند تحميل المكون لأول مرة
    useEffect(() => {
        fetchAdvertisements(true);
    }, [fetchAdvertisements]); // تعتمد على fetchAdvertisements لضمان تشغيلها مرة واحدة

    /**
     * دالة لمعالجة النقر على زر "المزيد".
     */
    const handleLoadMore = () => {
        fetchAdvertisements(false);
    };

    // عرض رسائل التحميل والخطأ
    if (loading && advertisements.length === 0) return <p className="loading-message">جاري تحميل الإعلانات...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="advertisements-page-container page-container">
            <h2 className="page-title">الإعلانات</h2>
            {advertisements.length > 0 ? (
                <div className="advertisements-grid">
                    {advertisements.map(ad => (
                        <div key={ad.id} className="advertisement-card">
                            {/* عرض الصورة إذا كانت موجودة، وإلا عرض مكانًا بديلاً */}
                            {ad.imageUrl ? (
                                <img
                                    src={ad.imageUrl}
                                    alt={ad.title}
                                    className="advertisement-image"
                                    onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/400x200/F0F0F0/333333?text=No+Image"; }}
                                />
                            ) : (
                                <div className="advertisement-image-placeholder">
                                    <span className="placeholder-text">لا توجد صورة</span>
                                </div>
                            )}
                            <h3 className="advertisement-title">{ad.title}</h3>
                            <p className="advertisement-description">{ad.description}</p>
                            {/* تنسيق وعرض التاريخ */}
                            {ad.date && ad.date.seconds && <p className="advertisement-date">التاريخ: {new Date(ad.date.seconds * 1000).toLocaleDateString('ar-EG')}</p>}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-advertisements-message">لا توجد إعلانات لعرضها حاليًا.</p>
            )}

            {/* زر "المزيد" يظهر فقط إذا كان هناك المزيد من الإعلانات ولم نكن في حالة تحميل */}
            {hasMore && (
                <button onClick={handleLoadMore} className="load-more-button" disabled={loading}>
                    {loading ? "جاري التحميل..." : "المزيد من الإعلانات"}
                </button>
            )}
        </div>
    );
}
