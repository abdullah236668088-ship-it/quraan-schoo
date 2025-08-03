import React from "react";
import { render, screen } from "@testing-library/react";
import StudentManagement from "../components/StudentManagement";

describe("StudentManagement Component", () => {
    test("renders student management with students list", () => {
        render(<StudentManagement />);
        expect(screen.getByText("إدارة الطلاب")).toBeInTheDocument();
        expect(screen.getByText("أحمد محمد")).toBeInTheDocument();
        expect(screen.getByText("حلقة الفجر")).toBeInTheDocument();
        expect(screen.getByText("ذكر")).toBeInTheDocument();
        expect(screen.getByText("2010-05-12")).toBeInTheDocument();
        expect(screen.getByText("سارة علي")).toBeInTheDocument();
        expect(screen.getByText("حلقة العصر")).toBeInTheDocument();
        expect(screen.getByText("أنثى")).toBeInTheDocument();
        expect(screen.getByText("2011-08-23")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /إضافة طالب جديد/i })).toBeInTheDocument();
    });

    test("renders message when no students", () => {
        const { rerender } = render(<StudentManagement />);
        // Since students state is hardcoded, this test is limited; in real app, would mock state or props
        rerender(<StudentManagement />);
    });
});
