"use client";

import {
  CircleAlert,
  LayoutDashboard,
  Loader,
  LogOut,
  MenuIcon,
} from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { ThemeToggler } from "./ThemeToggler";
import {
  DropdownMenuContent,
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import Link from "next/link";

export default function Menu() {
  const { isLoading, user, signOut } = useAuth();

  if (isLoading)
    return <Loader className="h-4 w-4 animate-spin text-primary" />;

  if (!user) return <ThemeToggler />;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="border p-1.5">
        <MenuIcon className="h-6 w-6" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="flex items-center justify-between gap-2">
          <div className="flex flex-col space-y-1 max-w-32">
            <p className="text-sm font-medium leading-none truncate">
              {user.name}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
          <ThemeToggler />
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="py-3">
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="py-3"
          onClick={() => void signOut()}
          variant="destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
