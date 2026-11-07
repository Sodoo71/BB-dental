import type { Metadata } from "next";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/merriweather/400.css";
import "@fontsource/merriweather/600.css";
import "./styles/design-tokens.css";
import "./globals.css";
import "./erp/erp.css";
import "./v2-theme.css";
import "./styles/bloom.css";
import ThemeToggle from "./components/theme-toggle";
import { ClinicBrandingProvider } from "./components/clinic-branding";

export const metadata: Metadata = {
  title: "BB Dental Clinic",
  description: "BB Dental Clinic · Шүдний эмнэлэг, онлайн цаг захиалга",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="mn" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('bb-theme');document.documentElement.dataset.theme=t==='light'||t==='dark'?t:matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ClinicBrandingProvider>
          {children}
          <ThemeToggle />
        </ClinicBrandingProvider>
      </body>
    </html>
  );
}
