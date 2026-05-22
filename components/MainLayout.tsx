"use client";

import { Navbar } from "@/components/Navbar";
import { Sidebar, MobileMenuButton } from "@/components/Sidebar";
import { useState, useCallback } from "react";

interface MainLayoutProps {
  children: React.ReactNode;
  showSidebar?: boolean;
}

export function MainLayout({ children, showSidebar = true }: MainLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const closeSidebar = useCallback(() => {
    setSidebarOpen(false);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar
        mobileMenuButton={
          showSidebar ? (
            <MobileMenuButton onClick={() => setSidebarOpen(true)} />
          ) : null
        }
      />
      {showSidebar && <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />}
      <main
        className={`pt-16 transition-[padding] duration-300 ${
          showSidebar ? "lg:pl-64" : ""
        }`}
      >
        <div className="min-h-[calc(100vh-4rem)] p-4 md:p-6 xl:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
