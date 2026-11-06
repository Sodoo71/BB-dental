import type { Metadata } from "next";
export const metadata: Metadata = { title: "Ажилтны бүртгэл · BB Dental" };
import AuthForm from "../components/auth-form";
export default function RegisterPage() {
  return <AuthForm mode="register" />;
}
