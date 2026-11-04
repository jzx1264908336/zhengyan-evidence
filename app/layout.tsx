import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "证研 · 个股研究台",
  description: "从结论回到证据。可核验的个股多维诊断与研究工作台。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
