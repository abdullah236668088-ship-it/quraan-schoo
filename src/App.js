// src/App.js
import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Import all necessary page components from src/components/
import Navbar from './components/NavigationBar';
import Footer from './components/Footer';
import './Styles/App.css'; // استيراد ملف التنسيقات الرئيسي

// استخدام React.lazy لتحميل المكونات عند الحاجة فقط (تقسيم الكود)
const LoginPage = lazy(() => import('./components/Login'));
const RegisterPage = lazy(() => import('./components/RegisterPage'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const HalaqatPage = lazy(() => import('./components/HalaqatPage'));
const StudentManagement = lazy(() => import('./components/StudentManagement'));
const WeeklyReportsPage = lazy(() => import('./components/WeeklyReports'));
const ReportsPage = lazy(() => import('./components/ReportsPage'));
const UserProfilePage = lazy(() => import('./components/UserProfilePage'));
const UserManagement = lazy(() => import('./components/UserManagement'));
const ActivitiesManagement = lazy(() => import('./components/ActivitiesManagement'));
const StudentSearchGuest = lazy(() => import('./components/StudentSearchGuest'));
const TeachersPage = lazy(() => import('./components/Teachers'));
const HomePage = lazy(() => import('./components/HomePage'));
const ChartsPage = lazy(() => import('./components/Charts'));
const StatisticsPage = lazy(() => import('./components/StatisticsPage'));
const AdvertisementsPage = lazy(() => import('./components/AdvertisementsPage'));



// PrivateRoute component to protect routes based on authentication and role
function PrivateRoute({ children, allowedRoles }) {
    const { currentUser, userRole, loading, isAuthReady } = useAuth();

    // Show loading state until authentication status is determined
    if (loading || !isAuthReady) {
        return <div className="loading-full-page">جاري التحميل...</div>;
    }

    // If no current user, redirect to login
    if (!currentUser) {
        return <Navigate to="/login" replace />;
    }

    // If user is authenticated but role is not allowed, redirect to home or unauthorized page
    if (allowedRoles && !allowedRoles.includes(userRole)) {
        // You might want a specific unauthorized page here, or redirect to home
        return <Navigate to="/" replace />;
    }

    // If authenticated and role is allowed, render the children components
    return children;
}

// Layout component for routes accessible by admin and teacher
function AdminTeacherLayout() {
    return <PrivateRoute allowedRoles={['admin', 'teacher']}><Outlet /></PrivateRoute>;
}

// Layout component for routes accessible by admin only
function AdminOnlyLayout() {
    return <PrivateRoute allowedRoles={['admin']}><Outlet /></PrivateRoute>;
}

// AppContent component to handle routing and layout
function AppContent() {
    const { currentUser, userRole, loading, isAuthReady } = useAuth();

    // Determine the dashboard path based on user role
    const getDashboardPath = () => {
        if (!currentUser) {
            return '/'; // Redirect unauthenticated users to home
        }
        switch (userRole) {
            case 'admin':
                return '/dashboard';
            case 'teacher':
                return '/dashboard';
            case 'guest':
                return '/student-search-guest'; // Guests might have a specific landing page
            default:
                return '/'; // Fallback for unknown roles or if no specific dashboard
        }
    };

    // Render loading state for the entire app content if auth is not ready
    if (loading || !isAuthReady) {
        return <div className="loading-full-page">جاري تحميل التطبيق...</div>;
    }

    return (
        <>
            <Navbar /> {/* Render Navbar always */}
            <Suspense fallback={<div className="loading-full-page">جاري تحميل الصفحة...</div>}>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route path="/student-search-guest" element={<StudentSearchGuest />} />

                    {/* Admin & Teacher Routes */}
                    <Route element={<AdminTeacherLayout />}>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/halaqat" element={<HalaqatPage />} />
                        <Route path="/students" element={<StudentManagement />} />
                        <Route path="/weekly-reports" element={<WeeklyReportsPage />} />
                        <Route path="/reports" element={<ReportsPage />} />
                        <Route path="/charts" element={<ChartsPage />} />
                        <Route path="/statistics" element={<StatisticsPage />} />
                        <Route path="/AdvertisementsPage" element={<AdvertisementsPage />} />
                    </Route>

                    {/* Admin Only Routes */}
                    <Route element={<AdminOnlyLayout />}>
                        <Route path="/activities" element={<ActivitiesManagement />} />
                        <Route path="/users" element={<UserManagement />} />
                        <Route path="/teachers" element={<TeachersPage />} />
                    </Route>

                    {/* Routes for all authenticated users */}
                    <Route
                        path="/profile"
                        element={
                            <PrivateRoute allowedRoles={['admin', 'teacher', 'guest']}>
                                <UserProfilePage />
                            </PrivateRoute>
                        }
                    />

                    {/* توجيه المسارات غير المطابقة:
                    - إذا كان المستخدم مسجلاً للدخول، وجهه إلى لوحة التحكم المناسبة لدوره.
                    - إذا لم يكن مسجلاً للدخول، وجهه إلى الصفحة الرئيسية. */}
                    <Route path="*" element={<Navigate to={getDashboardPath()} replace />} />
                </Routes>
            </Suspense>
            {/* Render Footer always */}
            <Footer />
        </>
    );
}

// Main App component
export default function App() {
    return (
        <Router>
            <AuthProvider>
                <AppContent />
            </AuthProvider>
        </Router>
    );
}
