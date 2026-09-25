import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/600.css";
import "./globals.css";
import { Toaster } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "BB Dental Clinic",
  description: "BB Dental Clinic захиалга удирдах систем",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
