import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import ServiceWorkerRegistration from "../components/ServiceWorkerRegistration";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://conferly.site"),
  title: {
    default: "Conferly | The Dual-Mode Workspace for Tutors & Pros",
    template: "%s | Conferly - AI-Powered Tutoring & Meetings",
  },
  description:
    "Host professional classrooms and boardrooms with real-time AI translation, collaborative whiteboards, and automated lesson summaries. Localized ZAR pricing starting at R89/mo.",
  applicationName: "Conferly",
  authors: [{ name: "Conferly Team" }],
  keywords: [
    "Online Tutoring South Africa",
    "AI Meeting Summary",
    "Virtual Classroom Whiteboard",
    "LiveKit Video Conferencing",
    "ZAR Tutoring Platform",
  ],
  openGraph: {
    type: "website",
    locale: "en_ZA",
    url: "https://conferly.site",
    siteName: "Conferly",
    title: "Conferly | The Dual-Mode Workspace for Tutors & Pros",
    description:
      "Host professional classrooms and boardrooms with real-time AI translation, collaborative whiteboards, and automated lesson summaries. Localized ZAR pricing starting at R89/mo.",
    images: [
      {
        url: "/icons/og-image.png",
        width: 1200,
        height: 630,
        alt: "Conferly — AI-Powered Tutoring & Meetings",
        type: "image/png",
      },
      // Fallback in case og-image.png is not present in the public folder
      {
        url: "/icons/icon-512.png",
        width: 512,
        height: 512,
        alt: "Conferly",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Conferly | The Dual-Mode Workspace for Tutors & Pros",
    description:
      "Host professional classrooms and boardrooms with real-time AI translation, collaborative whiteboards, and automated lesson summaries. Localized ZAR pricing starting at R89/mo.",
    images: [
      "/icons/og-image.png",
    ],
  },
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-512.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Conferly",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Conferly",
    applicationCategory: ["EducationalApplication", "BusinessApplication"],
    operatingSystem: ["Web", "Android", "iOS"],
    url: "https://conferly.site",
    description:
      "AI-Powered Tutoring & Business Conferencing platform with real-time translation, collaborative whiteboards, and automated summaries.",
    offers: {
      "@type": "Offer",
      priceCurrency: "ZAR",
      price: "149",
      description: "Pro plan: R149/month, unlimited meetings, AI summaries & translation",
    },
    featureList: [
      "AI Summaries",
      "Real-time Multilingual Translation",
      "Collaborative Whiteboard",
      "99.9% Resilience via Circuit Breaker",
    ],
  } as const;
  return (
    <html lang="en" className="h-full antialiased">
      <head>
        {/* Inline minimal critical CSS to guarantee a fast first paint while the
            full Tailwind stylesheet loads. Keep this as small as possible. */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root{--background:#0a0a0a;--foreground:#ededed}
          html,body,#root{height:100%}
          body{margin:0;background:var(--background);color:var(--foreground);font-family:Arial, Helvetica, sans-serif}
          .min-h-full{min-height:100vh}
        ` }} />
        {/* Next.js handles data-precedence="next" stylesheet loading automatically. */}
        {/* Google Tag Manager (gtag.js) - initialized when NEXT_PUBLIC_GA_ID is set */}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
              strategy="afterInteractive"
            />
            <Script
              id="gtag-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{ __html: `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('js', new Date()); gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', { 'anonymize_ip': true });` }}
            />
          </>
        )}

        {/* JSON-LD Structured Data for Google */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        {children}
        <ServiceWorkerRegistration />
        <SpeedInsights />
      </body>
    </html>
  );
}
