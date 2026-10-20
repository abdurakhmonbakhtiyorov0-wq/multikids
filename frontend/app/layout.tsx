import type { Metadata, Viewport } from "next";
import { Inter, Nunito } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { ModuleProvider } from "@/lib/module-context";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";
import { MODULE_BOOT_SCRIPT } from "@/lib/module";
import { PwaRegister } from "@/components/PwaRegister";

const nunito = Nunito({ variable: "--font-nunito", subsets: ["latin", "latin-ext", "cyrillic"] });
// O‘rta, yuqori va maxsus modullar uchun jiddiyroq shrift (boshlang‘ichda Nunito).
const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext", "cyrillic"] });

export const metadata: Metadata = {
  title: "MultiKids — o‘yin orqali o‘rgan",
  description: "1–11-sinf va SAT uchun interaktiv o‘quv platformasi: testlar, natijalar va o‘sish",
  icons: { apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "MultiKids", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: "#2563eb", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" className={`${nunito.variable} ${inter.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: MODULE_BOOT_SCRIPT }} />
      </head>
      <body className="flex min-h-full flex-col font-sans">
        <ModuleProvider>
          <I18nProvider>
            <AuthProvider>{children}</AuthProvider>
          </I18nProvider>
        </ModuleProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
