import type { Metadata } from "next";
import "./globals.css";
import ThemeToggle from "./components/theme-toggle";
import { ClinicBrandingProvider } from "./components/clinic-branding";

export const metadata: Metadata = {
  title: "BB Dental Clinic",
  description: "",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <body>
        <ClinicBrandingProvider>
          {children}
          <ThemeToggle />
        </ClinicBrandingProvider>
      </body>
    </html>
  );
}
