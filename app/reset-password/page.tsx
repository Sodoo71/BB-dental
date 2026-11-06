import type { Metadata } from "next";
export const metadata: Metadata = {
  referrer: "no-referrer",
  title: "Шинэ нууц үг · BB Dental",
};
import AuthForm from "../components/auth-form";
export default function ResetPasswordPage() {
  return <AuthForm mode="reset" />;
}
