// src/components/Footer.js
import React from 'react';
import { Link } from 'react-router-dom'; // استيراد Link
import '../Styles/FooterStyles.css'; // استيراد ملف التنسيقات

export default function Footer() {
    return (
        <footer className="footer" role="contentinfo"> {/* إضافة role="contentinfo" لتحسين إمكانية الوصول */}
            <div className="footer-content">
                <p>&copy; {new Date().getFullYear()} متابعة حفظ القرآن. جميع الحقوق محفوظة.</p>
                <div className="footer-links">
                    {/* استخدام مكون Link للتنقل الداخلي بدلاً من روابط الهاش */}
                    <Link to="/privacy-policy" className="footer-link">سياسة الخصوصية</Link>
                    <Link to="/terms-of-service" className="footer-link">شروط الخدمة</Link>
                    <Link to="/contact-us" className="footer-link">اتصل بنا</Link>
                </div>
            </div>
        </footer>
    );
}
