import type { Metadata } from "next";
import localFont from "next/font/local";
import { Inter, IBM_Plex_Sans, Source_Sans_3, Work_Sans } from "next/font/google";
import "./globals.css";
import { brand } from "@/lib/brand.config";

const libreBaskerville = localFont({
  src: [
    { path: "./fonts/LibreBaskerville-Regular.ttf", weight: "400", style: "normal" },
    { path: "./fonts/LibreBaskerville-Bold.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-heading",
  display: "swap",
});

// ponytail: Code New Roman (SIL OFL 1.1, Sam Radian) — kept for --font-mono
// (code blocks) only. It used to also feed --font-sans (body text), which
// made chat prose read as monospace (owner critique 2026-07-11) — body now
// defaults to Inter below, with a picker in Settings among these 5.
const codeNewRoman = localFont({
  src: [
    { path: "./fonts/CodeNewRoman-Regular.otf", weight: "400", style: "normal" },
    { path: "./fonts/CodeNewRoman-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-code",
  display: "swap",
});

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const ibmPlexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-ibm-plex", display: "swap" });
const sourceSans3 = Source_Sans_3({ subsets: ["latin"], variable: "--font-source-sans", display: "swap" });
const workSans = Work_Sans({ subsets: ["latin"], variable: "--font-work-sans", display: "swap" });

export const metadata: Metadata = {
  title: brand.name,
  description: brand.description,
  icons: {
    icon: "/seo/icon.png",
    apple: "/seo/apple-icon.png",
  },
  openGraph: {
    images: ["/seo/og-banner.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${libreBaskerville.variable} ${codeNewRoman.variable} ${inter.variable} ${ibmPlexSans.variable} ${sourceSans3.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
