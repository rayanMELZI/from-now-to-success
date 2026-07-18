import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
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
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col bg-stone-100 text-stone-800 transition-colors dark:bg-stone-950 dark:text-stone-200">
        {/* set the theme class before first paint to avoid a flash */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var t=localStorage.theme;var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()",
          }}
        />
        <ThemeProvider>
          <AuthProvider>
            <RegisterSW />
            <Nav />
            {/* bottom padding clears the mobile tab bar */}
            <main className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</main>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
