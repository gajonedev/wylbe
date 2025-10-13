import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import Link from "next/dist/client/link";
import { ThemeToggler } from "@/components/ThemeToggler";
import { appwriteAccount } from "@/lib/appwrite";
import Menu from "@/components/Menu";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Wylbe | Ajouter vos photos à vos visuels",
  description: "Générez des visuels à partir de vos photos",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body className={`${outfit.variable} antialiased font-outfit`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <header className="sticky top-0 right-0 z-30 w-full backdrop-blur-3xl border-b flex p-4 md:p-6 text-center justify-between text-2xl font-bold">
              <Link href="/">
                <h1 className="text-2xl font-bold text-primary">Wylbe</h1>
              </Link>
              <div className="flex items-center gap-4">
                <Button>Soutenir</Button>
                <Menu />
              </div>
            </header>
            {children}
            <footer className="w-full p-6 text-center text-xs text-muted-foreground">
              <p>
                &copy; {new Date().getFullYear()} Wylbe. Créé par{" "}
                <a
                  href="https://gajone.dev?utm_source=wylbe&utm_campaign=oss"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-primary"
                >
                  Gajone Dev
                </a>
                . Tous droits réservés.
              </p>
            </footer>
          </AuthProvider>
          <Toaster richColors position="top-right" theme="dark" />
        </ThemeProvider>
      </body>
    </html>
  );
}
