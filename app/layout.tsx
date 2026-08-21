import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BB Dental Clinic",
  description: "BB Dental Clinic захиалга удирдах систем",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
