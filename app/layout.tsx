import type { Metadata } from "next";
import { Outfit, Poppins } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Toaster } from "sonner";
import { Button } from "@/components/ui/button";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Wylbe | Ajouter vos photos à vos visuels",
  description: "Générez des visuels à partir de vos photos",
};

export default function RootLayout({
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
            <header className="sticky top-0 right-0 z-30 w-full bg-card flex p-6 text-center justify-between text-2xl font-bold text-primary">
              <h1 className="text-2xl font-bold">Wylbe</h1>
              <Button>Soutenir</Button>
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
