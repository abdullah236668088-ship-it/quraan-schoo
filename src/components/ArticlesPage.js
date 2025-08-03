// src/pages/ArticlesPage.js
import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, orderBy, limit, startAfter, getDocs } from 'firebase/firestore';
import '../Styles/ArticlesPageStyles.css'; // استيراد ملف التنسيقات الخاص بالصفحة

export default function ArticlesPage() {
    // حالة لتخزين المقالات
    const [articles, setArticles] = useState([]);
    // حالة التحميل
    const [loading, setLoading] = useState(true);
    // حالة الخطأ
    const [error, setError] = useState('');
    // لتتبع آخر مستند تم عرضه لخاصية "المزيد" (pagination)
    const [lastVisible, setLastVisible] = useState(null);
    // لتحديد ما إذا كانت هناك المزيد من المقالات لجلبها
    const [hasMore, setHasMore] = useState(true);

    // عدد المقالات التي يتم جلبها في كل مرة عند النقر على "المزيد"
    const FETCH_LIMIT = 3;

    /**
     * دالة لجلب المقالات من Firestore.
     * @param {boolean} initialLoad - لتحديد ما إذا كان هذا هو التحميل الأولي للصفحة.
     */
    const fetchArticles = useCallback(async (initialLoad = true) => {
        setLoading(true);
        setError('');

        try {
            let q;
            if (initialLoad) {
                // الاستعلام الأولي: يجلب أول FETCH_LIMIT من المقالات
                q = query(
                    collection(db, "articles"), // اسم مجموعة المقالات في Firestore
                    orderBy("publishDate", "desc"), // ترتيب حسب تاريخ النشر تنازلياً
                    limit(FETCH_LIMIT)
                );
            } else {
                // الاستعلام لـ "المزيد": يجلب FETCH_LIMIT مقالًا بعد آخر مقال مرئي
                q = query(
                    collection(db, "articles"),
                    orderBy("publishDate", "desc"),
                    startAfter(lastVisible), // يبدأ من بعد آخر مستند تم جلبه
                    limit(FETCH_LIMIT)
                );
            }

            const documentSnapshots = await getDocs(q);
            const newArticles = documentSnapshots.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            // تحديث حالة lastVisible لآخر مستند تم جلبه، لاستخدامه في التحميل التالي
            setLastVisible(documentSnapshots.docs[documentSnapshots.docs.length - 1]);

            // التحقق مما إذا كانت هناك المزيد من المقالات: إذا كان عدد المقالات التي تم جلبها أقل من FETCH_LIMIT، فهذا يعني أنه لا توجد المزيد.
            setHasMore(newArticles.length === FETCH_LIMIT);

            if (initialLoad) {
                setArticles(newArticles);
            } else {
                // إضافة المقالات الجديدة إلى القائمة الموجودة
                setArticles(prevArticles => [...prevArticles, ...newArticles]);
            }

        } catch (err) {
            console.error("Error fetching articles:", err);
            setError("فشل في جلب المقالات: " + err.message);
        } finally {
            setLoading(false);
        }
    }, [lastVisible]); // تعتمد على lastVisible لإعادة الجلب عند تغييرها

    // جلب المقالات عند تحميل المكون لأول مرة
    useEffect(() => {
        fetchArticles(true);
    }, [fetchArticles]); // تعتمد على fetchArticles لضمان تشغيلها مرة واحدة

    /**
     * دالة لمعالجة النقر على زر "المزيد".
     */
    const handleLoadMore = () => {
        fetchArticles(false);
    };

    // عرض رسائل التحميل والخطأ
    if (loading && articles.length === 0) return <p className="loading-message">جاري تحميل المقالات...</p>;
    if (error) return <p className="error-message">{error}</p>;

    return (
        <div className="articles-page-container page-container">
            <h2 className="page-title">المقالات</h2>
            {articles.length > 0 ? (
                <div className="articles-grid">
                    {articles.map(article => (
                        <div key={article.id} className="article-card">
                            <h3 className="article-title">{article.title}</h3>
                            <p className="article-summary">{article.summary}</p>
                            {/* تنسيق وعرض التاريخ */}
                            {article.publishDate && article.publishDate.seconds && <p className="article-date">تاريخ النشر: {new Date(article.publishDate.seconds * 1000).toLocaleDateString('ar-EG')}</p>}
                            {/* يمكنك إضافة زر "قراءة المزيد" إذا كان هناك صفحة تفاصيل للمقال */}
                            {/* <Link to={`/articles/${article.id}`} className="read-more-button">قراءة المزيد</Link> */}
                        </div>
                    ))}
                </div>
            ) : (
                <p className="no-articles-message">لا توجد مقالات لعرضها حاليًا.</p>
            )}

            {/* زر "المزيد" يظهر فقط إذا كان هناك المزيد من المقالات ولم نكن في حالة تحميل */}
            {hasMore && (
                <button onClick={handleLoadMore} className="load-more-button" disabled={loading}>
                    {loading ? "جاري التحميل..." : "المزيد من المقالات"}
                </button>
            )}
        </div>
    );
}
