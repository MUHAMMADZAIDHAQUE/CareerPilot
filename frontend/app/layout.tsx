import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RouteGuard from "@/components/RouteGuard";
import { ThemeProvider, ThemeScript } from "@/components/ThemeProvider";
import { AuthProvider } from "@/lib/authContext";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "CareerPilot — The AI Copilot for Your Career",
  description:
    "End-to-end career copilot: job discovery, fact-grounded resume tailoring, referral discovery, interview prep, and career insights.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <ThemeScript />
      </head>
      <body className="min-h-screen flex flex-col bg-white dark:bg-[#0b0f17] text-slate-900 dark:text-slate-100 antialiased selection:bg-slate-900 selection:text-white dark:selection:bg-white dark:selection:text-slate-900 transition-colors duration-200 overflow-x-hidden">
        <ThemeProvider>
          <AuthProvider>
            <Header />
            <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 overflow-x-hidden">
              <RouteGuard>{children}</RouteGuard>
            </main>
            <Footer />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
