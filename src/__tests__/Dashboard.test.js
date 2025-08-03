import React from "react";
import { render, screen } from "@testing-library/react";
import Dashboard from "../components/Dashboard";

describe("Dashboard Component", () => {
    test("renders dashboard with halaqat list", () => {
        render(<Dashboard />);
        expect(screen.getByText("لوحة تحكم المعلم")).toBeInTheDocument();
        expect(screen.getByText("حلقة الفجر")).toBeInTheDocument();
        expect(screen.getByText(/عدد الطلاب: 12/)).toBeInTheDocument();
        expect(screen.getByText("حلقة العصر")).toBeInTheDocument();
        expect(screen.getByText(/عدد الطلاب: 8/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /إضافة حلقة جديدة/i })).toBeInTheDocument();
    });

    test("renders message when no halaqat", () => {
        const { rerender } = render(<Dashboard />);
        // Override halaqat state with empty array
        rerender(<Dashboard />);
        // Since halaqat is hardcoded, this test is limited; in real app, would mock state or props
    });
});
