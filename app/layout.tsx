import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Шүдний эмнэлэг | Цаг захиалга",
  description: "Шүдний эмнэлгийн онлайн цаг захиалгын систем",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="mn" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
