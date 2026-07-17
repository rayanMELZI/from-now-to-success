import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { Nav } from "@/components/Nav";
import { RegisterSW } from "@/components/RegisterSW";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "fromNowToSuccess",
  description: "Your habit roadmap, from now to success",
  appleWebApp: { capable: true, title: "FNTS", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#fffbeb",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-stone-100 text-stone-800">
        <AuthProvider>
          <RegisterSW />
          <Nav />
          {/* bottom padding clears the mobile tab bar */}
          <main className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}
