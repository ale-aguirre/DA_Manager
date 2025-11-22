import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LadyNuggets Manager",
  description:
    "Automatización local de workflows de Stable Diffusion con FastAPI, scraping (cloudscraper) y Groq.",
  keywords: [
    "Stable Diffusion",
    "Civitai",
    "Groq",
    "FastAPI",
    "Rule34",
    "automatización",
    "LadyNuggets",
  ],
  applicationName: "LadyNuggets Manager",
  authors: [{ name: "Ale" }],
  creator: "Ale",
  publisher: "Ale",
  openGraph: {
    title: "LadyNuggets Manager",
    description: "Automatización local de workflows de Stable Diffusion.",
    url: "/",
    siteName: "LadyNuggets Manager",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "LadyNuggets" }],
    locale: "es_ES",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "LadyNuggets Manager",
    description: "Automatización local de workflows de Stable Diffusion.",
    images: ["/logo.png"],
  },
  icons: {
    icon: "/favicon.ico",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
