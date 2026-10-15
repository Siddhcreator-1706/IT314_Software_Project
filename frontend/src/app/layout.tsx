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
  title: "ResQ | Emergency Disaster Response & Geo-Platform",
  description: "ResQ - Indian Disaster Response Coordination & Real-Time Emergency Mapping Hub",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        />
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet-minimap@3.6.1/dist/Control.MiniMap.min.css"
        />
      </head>
      <body className="h-full w-full overflow-hidden m-0 p-0 bg-[#070d18] text-[#f8fafc] font-sans">
        {children}
      </body>
    </html>
  );
}
