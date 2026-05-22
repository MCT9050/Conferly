import type { Metadata } from "next";
import "./globals.css";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  title: "Conferly — Secure hybrid meetings",
  description: "Next.js-native conferencing with live translation, AI summaries, and low-latency collaboration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        {children}
        <ServiceWorkerRegistration />
      </body>
    </html>
  );
}
