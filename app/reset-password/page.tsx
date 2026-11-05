import type { Metadata } from "next";
export const metadata: Metadata = { referrer: "no-referrer" };
import AuthForm from "../components/auth-form";
export default function ResetPasswordPage() {
  return <AuthForm mode="reset" />;
}
