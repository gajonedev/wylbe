import Menu from "@/components/Menu";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import React from "react";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
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
    </>
  );
}
