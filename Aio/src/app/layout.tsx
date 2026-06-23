import type { Metadata } from "next";
import localFont from "next/font/local";
import { Outfit } from "next/font/google";
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

// Used by the /app product UI (mockup.css) in place of the generic
// "Inter" the original mockup shipped with — keeps the marketing site's
// serif/system pairing untouched.
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});

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
    <html lang="en" className={`${libreBaskerville.variable} ${outfit.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
