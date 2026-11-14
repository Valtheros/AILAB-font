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
  HardDrive,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useEffect, type RefObject } from "react";
import { authClient } from "@/lib/auth-client";
import { useLanguage } from "@/components/language-provider";

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
  menuButtonRef: RefObject<HTMLButtonElement | null>;
}

export function Sidebar({ isOpen, onClose, menuButtonRef }: SidebarProps) {
  const pathname = usePathname();
  const { data: session } = authClient.useSession();
  const { language } = useLanguage();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "admin";
  const visibleNavItems = isAdmin ? [...navItems, adminNavItem, { title: 'Compute', href: '/admin/compute', icon: ShieldCheck },
    { title: language === 'th' ? 'พื้นที่ผู้ใช้' : 'User storage', href: '/admin/storage', icon: HardDrive }] : navItems;

  // Close mobile sidebar when route changes
  useEffect(() => {
    onClose();
  }, [pathname, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => { if (desktop.matches) onClose(); };
    closeOnDesktop();
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, [isOpen, onClose]);

  const navigation = <nav className="flex-1 space-y-1 overflow-y-auto p-3">
    {visibleNavItems.map((item) => {
      const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} onClick={onClose}
        className={cn("flex items-center gap-3 rounded-md border px-3 py-2.5 text-sm font-medium transition-colors",
          isActive ? "border-foreground bg-foreground text-background" : "border-transparent text-muted-foreground hover:border-border hover:bg-accent hover:text-accent-foreground")}>
        <item.icon className="h-5 w-5 shrink-0" /><span>{item.title}</span>
      </Link>;
    })}
  </nav>;

  return (
    <>
      <aside className="fixed left-0 top-16 z-40 hidden h-[calc(100vh-4rem)] w-64 border-r border-border bg-card/95 backdrop-blur lg:block">
        {navigation}
      </aside>
      <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent showCloseButton={false} aria-describedby={undefined}
          onCloseAutoFocus={(event) => { event.preventDefault(); if (!window.matchMedia("(min-width: 1024px)").matches) menuButtonRef.current?.focus(); }}
          className="left-0 top-0 flex h-[100dvh] w-64 max-w-[85vw] translate-x-0 translate-y-0 flex-col gap-0 rounded-none p-0">
          <DialogTitle className="sr-only">{language === "th" ? "เมนู" : "Menu"}</DialogTitle>
          <div className="flex items-center justify-end p-3">
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={language === "th" ? "ปิดเมนู" : "Close menu"}><X className="h-5 w-5" /></Button>
          </div>
          {navigation}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Mobile menu button component
export function MobileMenuButton({ onClick, buttonRef }: { onClick: () => void; buttonRef: RefObject<HTMLButtonElement | null> }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={onClick}
      ref={buttonRef}
      className="lg:hidden"
      aria-label="Open menu"
    >
      <Menu className="h-5 w-5" />
    </Button>
  );
}
