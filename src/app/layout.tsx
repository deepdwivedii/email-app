import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import Link from "next/link";
import { AppLogo } from "@/components/icons";
import { AuthProvider } from "@/hooks/use-auth";
import AuthButton from "@/components/auth-button";
import MainNav from "@/components/main-nav";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

export const metadata: Metadata = {
  title: "Atlas",
  description: "Your digital accounts, carried in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <body className="bg-background text-foreground antialiased">
        <AuthProvider>
          <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
              <Link href="/" className="flex items-center gap-2">
                <AppLogo className="h-7 w-7 text-primary" />
                <span className="font-headline text-base font-bold">
                  Atlas
                </span>
              </Link>
              <div className="flex items-center gap-4">
                <MainNav />
                <AuthButton />
              </div>
            </div>
          </header>
          <main>{children}</main>
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
