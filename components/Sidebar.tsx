"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Tags,
  ListTodo,
  Menu,
  UserRound,
  ShieldCheck,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

const navItems = [
  { title: "Annotation", href: "/annotate", icon: Tags },
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Dataset",
    href: "/dataset",
    icon: Database,
  },
  {
    title: "Tasks",
    href: "/tasks",
    icon: ListTodo,
  },
  {
    title: "Account",
    href: "/account",
    icon: UserRound,
  },
];

const adminNavItem = {
  title: "Admin",
  href: "/admin/users",
  icon: ShieldCheck,
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const visibleNavItems = isAdmin ? [...navItems, adminNavItem, { title: 'Compute', href: '/admin/compute', icon: ShieldCheck }] : navItems;

  // Close mobile sidebar when route changes
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-16 z-40 h-[calc(100vh-4rem)] w-64 border-r border-border bg-card/95 backdrop-blur",
          // Desktop: always visible
          "hidden lg:block",
          // Mobile: slide in/out
          isOpen && "block lg:block"
        )}
      >
        <div className="flex h-full flex-col">
          {/* Mobile close button */}
          <div className="flex items-center justify-end p-3 lg:hidden">
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <nav className="flex-1 space-y-1 p-3">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                className={cn(
                    "flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
                    isActive
                      ? "border-foreground bg-foreground text-background"
                      : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}

// Mobile menu button component
export function MobileMenuButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      className="lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
