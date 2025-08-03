import React from "react";
import { render, screen } from "@testing-library/react";
import Charts from "../components/Charts";

jest.mock("firebase/firestore", () => ({
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    getDocs: jest.fn(() => Promise.resolve({ forEach: jest.fn() })),
}));

jest.mock("../firebaseConfig", () => ({
    db: {},
    auth: { currentUser: { uid: "testuid" } },
}));

describe("Charts Component", () => {
    test("renders loading state initially", () => {
        render(<Charts />);
        expect(screen.getByText("جاري تحميل البيانات...")).toBeInTheDocument();
    });
});
