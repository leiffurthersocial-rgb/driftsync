import type { Metadata, Viewport } from "next";
import { Inter, Pixelify_Sans } from "next/font/google";
import { Providers } from "@/components/shell/providers";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const pixel = Pixelify_Sans({ subsets: ["latin"], variable: "--font-pixel", display: "swap" });

export const metadata: Metadata = {
  title: "Driftsync",
  description: "A calm personal routine hub: plan your days, keep your to-dos and goals, see it all on a calendar.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f1e9" },
    { media: "(prefers-color-scheme: dark)", color: "#161326" },
  ],
};

/** Pick light/dark before paint so there's no flash (mirrors lib/daycycle + settings.theme). */
const themeScript = `(()=>{try{var d=JSON.parse(localStorage.getItem("driftsync:data")||"{}");var t=(d.settings&&d.settings.theme)||"auto";var h=new Date().getHours()+new Date().getMinutes()/60;var dark=t==="dark"||t==="dusk"||(t==="system"&&matchMedia("(prefers-color-scheme: dark)").matches)||(t==="auto"&&(h>=19.25||h<6.25));document.documentElement.dataset.theme=dark?"dark":"light"}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning className={`${sans.variable} ${pixel.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh font-sans">
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
