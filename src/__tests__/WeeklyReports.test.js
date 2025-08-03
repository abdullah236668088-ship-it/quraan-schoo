import React from "react";
import { render, screen } from "@testing-library/react";

// Placeholder WeeklyReports component for testing
function WeeklyReports() {
    return (
        <div dir="rtl" style={{ maxWidth: 800, margin: "auto", padding: 20, textAlign: "right" }}>
            <h2>التقارير الأسبوعية</h2>
            <p>لم يتم إضافة تقارير بعد.</p>
        </div>
    );
}

describe("WeeklyReports Component", () => {
    test("renders weekly reports placeholder", () => {
        render(<WeeklyReports />);
        expect(screen.getByText("التقارير الأسبوعية")).toBeInTheDocument();
        expect(screen.getByText("لم يتم إضافة تقارير بعد.")).toBeInTheDocument();
    });
});
