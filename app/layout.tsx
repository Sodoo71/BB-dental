import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "BB Dental Clinic",
  description: "BB Dental Clinic захиалга удирдах систем",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
