import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "./lib/providers/theme-provider";
import { QueryProvider } from "./lib/providers/query-provider";
import { cn } from "./lib/utils";

// Force dynamic rendering to avoid SSR issues with Supabase
export const dynamic = 'force-dynamic';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Conferly — Connecting with Purpose",
  description:
    "Premium video conferencing and collaboration platform rooted in the African philosophy of Ubuntu. Secure, inclusive, scalable.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.className, "min-h-screen bg-background font-sans antialiased")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <QueryProvider>{children}</QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}