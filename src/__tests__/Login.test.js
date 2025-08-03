import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Login from "../components/Login";
import { auth } from "../firebaseConfig";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "firebase/auth";

jest.mock("../firebaseConfig", () => ({
    auth: {}
}));

jest.mock("firebase/auth", () => ({
    signInWithEmailAndPassword: jest.fn(),
    sendPasswordResetEmail: jest.fn()
}));

describe("Login Component", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test("renders login form", () => {
        render(<Login />);
        expect(screen.getByText("تسجيل دخول المعلم")).toBeInTheDocument();
        expect(screen.getByLabelText("البريد الإلكتروني:")).toBeInTheDocument();
        expect(screen.getByLabelText("كلمة المرور:")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /تسجيل الدخول/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /نسيت كلمة المرور؟/i })).toBeInTheDocument();
    });

    test("shows error if login fails", async () => {
        signInWithEmailAndPassword.mockRejectedValue(new Error("فشل تسجيل الدخول"));
        render(<Login />);
        fireEvent.change(screen.getByLabelText("البريد الإلكتروني:"), { target: { value: "test@example.com" } });
        fireEvent.change(screen.getByLabelText("كلمة المرور:"), { target: { value: "wrongpass" } });
        fireEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }));

        await waitFor(() => {
            expect(screen.getByText(/فشل تسجيل الدخول/i)).toBeInTheDocument();
        });
    });

    test("calls signInWithEmailAndPassword on login", async () => {
        signInWithEmailAndPassword.mockResolvedValue({});
        render(<Login />);
        fireEvent.change(screen.getByLabelText("البريد الإلكتروني:"), { target: { value: "test@example.com" } });
        fireEvent.change(screen.getByLabelText("كلمة المرور:"), { target: { value: "correctpass" } });
        fireEvent.click(screen.getByRole("button", { name: /تسجيل الدخول/i }));

        await waitFor(() => {
            expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, "test@example.com", "correctpass");
        });
    });

    test("shows error if reset password email is empty", () => {
        render(<Login />);
        fireEvent.click(screen.getByRole("button", { name: /نسيت كلمة المرور؟/i }));
        expect(screen.getByText(/يرجى إدخال البريد الإلكتروني لإعادة تعيين كلمة المرور/i)).toBeInTheDocument();
    });

    test("calls sendPasswordResetEmail on reset password", async () => {
        sendPasswordResetEmail.mockResolvedValue({});
        render(<Login />);
        fireEvent.change(screen.getByLabelText("البريد الإلكتروني:"), { target: { value: "test@example.com" } });
        fireEvent.click(screen.getByRole("button", { name: /نسيت كلمة المرور؟/i }));

        await waitFor(() => {
            expect(sendPasswordResetEmail).toHaveBeenCalledWith(auth, "test@example.com");
            expect(screen.getByText(/تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني/i)).toBeInTheDocument();
        });
    });
});
