import type { Metadata } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
      <head>
        {/* Inline minimal critical CSS to guarantee a fast first paint while the
            full Tailwind stylesheet loads. Keep this as small as possible. */}
        <style dangerouslySetInnerHTML={{ __html: `
          :root{--background:#0a0a0a;--foreground:#ededed}
          html,body,#root{height:100%}
          body{margin:0;background:var(--background);color:var(--foreground);font-family:Arial, Helvetica, sans-serif}
          .min-h-full{min-height:100vh}
        ` }} />
        {/* Try to make the Next-generated global stylesheet non-blocking: convert
            it to a preload then swap to stylesheet onload. This reduces blocking
            render time while preserving styles. */}
        <script dangerouslySetInnerHTML={{ __html: `
          (function(){
            try{
              var l = document.querySelector('link[data-precedence="next"][rel="stylesheet"]');
              if(l){
                l.rel = 'preload';
                l.as = 'style';
                l.onload = function(){ this.rel = 'stylesheet'; };
                // In case onload doesn't fire (older browsers), ensure stylesheet
                // is applied after a short timeout.
                setTimeout(function(){ if(l.rel !== 'stylesheet') l.rel='stylesheet'; }, 3000);
              }
            }catch(e){/* no-op */}
          })();
        ` }} />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-white">
        {children}
        <ServiceWorkerRegistration />
        <SpeedInsights />
      </body>
    </html>
  );
}
