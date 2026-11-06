import type { Metadata } from "next";
export const metadata: Metadata = { title: "Нууц үг сэргээх · BB Dental" };
import AuthForm from "../components/auth-form";
export default function ForgotPasswordPage() {
  return <AuthForm mode="forgot" />;
}
