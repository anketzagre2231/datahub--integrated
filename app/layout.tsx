import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "DataHub — Financial Suite",
  description:
    "Modern SaaS accounting dashboard for managing invoices, customers, balance sheets, and financial reports.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex">
        <Sidebar />
        <main className="flex-1 ml-[210px] min-h-screen flex flex-col">
          {children}
        </main>
      </body>
    </html>
  );
}
