import React from "react";
// استخدام createRoot مباشرة من "react-dom/client" وهي الطريقة الموصى بها في React 18
import { createRoot } from "react-dom/client";
import App from "./App";

// الحصول على العنصر الجذر من HTML
const container = document.getElementById("root");
// إنشاء جذر React جديد
const root = createRoot(container);

// عرض المكون الرئيسي App داخل وضع صارم لـ React
// React.StrictMode يساعد في تحديد المشاكل المحتملة في تطبيقك أثناء التطوير
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);
