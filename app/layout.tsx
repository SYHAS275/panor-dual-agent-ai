import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "PANOR.AI - Intelligent Document & Image Analyzer",
  description: "Upload documents and images, get AI-powered analysis from Gemini and ChatGPT, and receive the best combined answer.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className={`${inter.className} antialiased bg-[#000000] text-white min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
