import React from "react";
import { useAuth } from "../contexts/AuthContext";
import AdminDashboard from "./AdminDashboard";
import TeacherDashboard from "./TeacherDashboard";
import '../Styles/DashboardStyles.css';

/**
 * Dashboard component that acts as a router based on user role.
 * It renders the appropriate dashboard (Admin or Teacher) or an unauthorized message.
 */
export default function Dashboard() {
    const { userRole } = useAuth();

    // عرض لوحة تحكم المدير إذا كان الدور "أدمن"
    if (userRole === "admin") {
        return <AdminDashboard />;
    }

    // عرض لوحة تحكم المعلم إذا كان الدور "معلم"
    if (userRole === "teacher") {
        return <TeacherDashboard />;
    }

    // إذا لم يكن الدور "أدمن" أو "معلم"، سيعرض هذا
    return <div className="unauthorized-message">ليس لديك الصلاحية للوصول إلى هذه الصفحة.</div>;
}
