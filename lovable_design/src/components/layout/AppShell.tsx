import type { ReactNode } from "react";

import { AppNav } from "./AppNav";
import { MobileTopBar } from "./MobileTopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { mockUser, mockUnreadNotifications } from "@/mock/profile";
import { cn } from "@/lib/utils";

export type AppShellProps = {
  activeKey: string;
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  notificationCount?: number;
  /** Aura uses a fixed-height chat layout instead of normal page scroll padding. */
  mainClassName?: string;
  children: ReactNode;
};

/** Shared authenticated chrome: one nav implementation for every Nexali page. */
export function AppShell({
  activeKey,
  userName = mockUser.name,
  userEmail = mockUser.email,
  userAvatarUrl,
  notificationCount = mockUnreadNotifications,
  mainClassName,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <AppNav
        activeKey={activeKey}
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        notificationCount={notificationCount}
      />
      <MobileTopBar
        userName={userName}
        userEmail={userEmail}
        userAvatarUrl={userAvatarUrl}
        notificationCount={notificationCount}
      />

      <main
        id="main"
        className={cn(
          "flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))] pt-[calc(3.5rem+env(safe-area-inset-top,0px)+1.5rem)] md:pb-16 md:pt-[calc(4rem+2rem)]",
          mainClassName,
        )}
      >
        {children}
      </main>

      <MobileBottomNav activeKey={activeKey} />
    </div>
  );
}
