import React from "react";
import { render, screen } from "@testing-library/react";
import WeeklyReports from "../components/WeeklyReports";

jest.mock("firebase/firestore", () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ forEach: jest.fn() })),
    addDoc: jest.fn(),
    serverTimestamp: jest.fn(),
}));

jest.mock("../firebaseConfig", () => ({
    db: {},
    auth: { currentUser: { uid: "testuid" } },
}));

describe("WeeklyReports Component", () => {
    test("renders form and heading", () => {
        render(<WeeklyReports />);
        expect(screen.getByText("إدخال البيانات الأسبوعية")).toBeInTheDocument();
        expect(screen.getByLabelText("اختر الطالب:")).toBeInTheDocument();
        expect(screen.getByLabelText("تاريخ بداية الأسبوع:")).toBeInTheDocument();
        expect(screen.getByLabelText("عدد الصفحات المحفوظة:")).toBeInTheDocument();
        expect(screen.getByLabelText("الحضور:")).toBeInTheDocument();
        expect(screen.getByLabelText("التقييم:")).toBeInTheDocument();
        expect(screen.getByLabelText("ملاحظات:")).toBeInTheDocument();
    });
});
