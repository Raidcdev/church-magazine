import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "교회 계간지",
  description: "교회 계간지 원고 수합 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased min-h-screen bg-white text-gray-900">
        {children}
      </body>
    </html>
  );
}
