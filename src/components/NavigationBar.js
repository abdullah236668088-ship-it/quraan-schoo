// src/components/NavigationBar.js
import React, { useState, useCallback, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom'; // إضافة useLocation
import { useAuth } from '../contexts/AuthContext';
import '../Styles/NavigationBarStyles.css'; // استيراد ملف التنسيقات
import {
    Menu, X, LayoutDashboard, Book, Users, ClipboardList, BarChart, Search,
    User, Settings, GraduationCap, Activity, Home, LogIn, UserPlus, FileText, BarChart2, AlignEndVertical
} from 'lucide-react'; // استيراد الأيقونات

export default function Navbar() {
    const { currentUser, userRole, logout, loading: authLoading } = useAuth(); // تغيير اسم loading لتجنب التعارض
    const navigate = useNavigate();
    const location = useLocation(); // للحصول على المسار الحالي

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [currentTabTitle, setCurrentTabTitle] = useState("الرئيسية"); // حالة لاسم التبويبة الحالية

    // تحديث عنوان التبويبة الحالية بناءً على المسار
    useEffect(() => {
        const path = location.pathname;
        const allLinks = getNavLinks(currentUser, userRole);
        const currentLink = allLinks.find(link => link.path === path);
        if (currentLink) {
            setCurrentTabTitle(currentLink.name);
        } else if (path === '/') {
            setCurrentTabTitle("الرئيسية");
        } else {
            // Fallback for paths not explicitly defined in getNavLinks but still valid routes
            // يمكن تحسين هذا ليتطابق مع عناوين الصفحات الفعلية إذا كانت موجودة
            const pathSegments = path.split('/').filter(Boolean);
            if (pathSegments.length > 0) {
                setCurrentTabTitle(pathSegments[pathSegments.length - 1].replace(/-/g, ' ')); // تحويل /some-page إلى "some page"
            } else {
                setCurrentTabTitle("صفحة غير معروفة");
            }
        }
    }, [location.pathname, currentUser, userRole]); // إعادة التقييم عند تغيير المسار أو حالة المستخدم

    const handleLogout = useCallback(async () => {
        try {
            await logout();
            navigate('/login'); // التوجيه إلى صفحة تسجيل الدخول بعد تسجيل الخروج
        } catch (error) {
            console.error("فشل تسجيل الخروج:", error);
            // يمكن عرض رسالة خطأ للمستخدم هنا
        }
    }, [logout, navigate]);

    const toggleSidebar = useCallback(() => {
        setIsSidebarOpen(prev => !prev);
    }, []);

    if (authLoading) {
        return <div className="loading-message">جاري تحميل شريط التنقل...</div>; // مؤشر تحميل بسيط
    }

    // تعريف الروابط لكل دور
    const getNavLinks = useCallback((user, role) => {
        const commonLinks = [
            { name: 'الرئيسية', path: '/', icon: Home },
        ];

        if (!user) {
            // الروابط الافتراضية للزوار غير المسجلين
            return [
                ...commonLinks,
                { name: 'تسجيل الدخول', path: '/login', icon: LogIn },
                { name: 'التسجيل', path: '/register', icon: UserPlus },
            ];
        }

        // الروابط المشتركة للمستخدمين المسجلين الدخول
        const loggedInCommonLinks = [
            { name: 'لوحة التحكم', path: '/dashboard', icon: LayoutDashboard },
            { name: 'ملفي الشخصي', path: '/profile', icon: User },
            // 'بحث الطالب (للضيوف)' متاح لجميع الأدوار المسجلة
            { name: 'بحث الطالب (للضيوف)', path: '/student-search-guest', icon: Search },
        ];

        if (role === 'admin') {
            return [
                ...loggedInCommonLinks,
                { name: 'إدارة الحلقات', path: '/halaqat', icon: Book },
                { name: 'إدارة الطلاب', path: '/students', icon: Users },
                { name: 'إضافة تقرير أسبوعي', path: '/weekly-reports', icon: ClipboardList },
                { name: 'التقارير والإحصائيات', path: '/reports', icon: FileText },
                { name: 'إدارة الأنشطة', path: '/activities', icon: Activity },
                { name: 'إدارة المستخدمين', path: '/users', icon: Users },
                { name: 'إدارة الاعلاانات', path: '/AdvertisementsPage', icon: AlignEndVertical },

                { name: 'إدارة المعلمين', path: '/teachers', icon: GraduationCap },
                { name: 'الرسوم البيانية العامة', path: '/charts', icon: BarChart },
                { name: 'صفحة الإحصائيات', path: '/statistics', icon: BarChart2 },
            ];
        } else if (role === 'teacher') {
            return [
                ...loggedInCommonLinks,
                { name: 'إدارة الحلقات', path: '/halaqat', icon: Book },
                { name: 'إدارة الطلاب', path: '/students', icon: Users },
                { name: 'إضافة تقرير أسبوعي', path: '/weekly-reports', icon: ClipboardList },
                { name: 'إدارة الاعلاانات', path: '/AdvertisementsPage', icon: AlignEndVertical },
                { name: 'التقارير والإحصائيات', path: '/reports', icon: FileText },
                { name: 'الرسوم البيانية العامة', path: '/charts', icon: BarChart },
                { name: 'صفحة الإحصائيات', path: '/statistics', icon: BarChart2 },
            ];
        } else if (role === 'guest') {
            return [
                ...commonLinks, // الزوار يرون الصفحة الرئيسية
                { name: 'بحث الطالب (للضيوف)', path: '/student-search-guest', icon: Search },
                { name: 'ملفي الشخصي', path: '/profile', icon: User },
            ];
        }
        return commonLinks; // Fallback for unknown roles (shouldn't happen with proper role assignment)
    }, [currentUser, userRole]); // إعادة إنشاء الروابط فقط إذا تغير المستخدم أو دوره

    const navLinks = getNavLinks(currentUser, userRole);

    return (
        <nav className="navbar">
            {/* شريط التنقل لسطح المكتب (يظهر فقط على الشاشات الكبيرة) */}
            <div className="navbar-desktop">
                <div className="navbar-brand">
                    <Link to="/" className="navbar-logo">
                        مدرسه القدس نظام متابعة حفظ القرآن
                    </Link>
                </div>
                <ul className="navbar-links">
                    {navLinks.map((link, index) => (
                        <li key={index}>
                            <Link
                                to={link.path}
                                className={`navbar-link ${location.pathname === link.path ? 'active-link' : ''}`}
                            >
                                {link.icon && <link.icon size={20} className="navbar-icon" />}
                                {link.name}
                            </Link>
                        </li>
                    ))}
                    {currentUser && (
                        <li>
                            <button onClick={handleLogout} className="logout-button">
                                تسجيل الخروج
                            </button>
                        </li>
                    )}
                </ul>
            </div>

            {/* شريط التنقل للجوال (يظهر فقط على الشاشات الصغيرة) */}
            <div className="navbar-mobile">
                <div className="mobile-header">
                    <div className="mobile-brand-and-title">
                        <span className="mobile-app-name">                         مدرسه القدس نظام متابعة حفظ القرآن
                        </span>
                        <span className="mobile-current-tab-title">{currentTabTitle}</span>
                    </div>
                    <Menu size={28} className="hamburger-menu" onClick={toggleSidebar} />
                </div>
            </div>

            {/* القائمة الجانبية (لشاشات الجوال) */}
            <div className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
                <div className="sidebar-header">
                    <span className="user-info">
                        مرحباً, {currentUser?.displayName || currentUser?.email || 'مستخدم'} ({userRole || 'زائر'})
                    </span>
                    <X size={28} className="close-sidebar" onClick={toggleSidebar} />
                </div>
                <ul className="sidebar-links">
                    {navLinks.map((link, index) => (
                        <li key={index} onClick={() => setIsSidebarOpen(false)}>
                            <Link
                                to={link.path}
                                className={`sidebar-link ${location.pathname === link.path ? 'active-link' : ''}`}
                            >
                                {link.icon && <link.icon size={20} className="sidebar-icon" />}
                                {link.name}
                            </Link>
                        </li>
                    ))}
                    {currentUser && (
                        <li>
                            <button onClick={() => { handleLogout(); setIsSidebarOpen(false); }} className="sidebar-logout-button">
                                تسجيل الخروج
                            </button>
                        </li>
                    )}
                </ul>
            </div>
            {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>} {/* طبقة التراكب لإغلاق القائمة */}
        </nav>
    );
}
