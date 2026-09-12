import { Link } from "@tanstack/react-router";
import { Bell, ChevronDown, CircleUser, LogOut, Settings, ShieldCheck } from "lucide-react";

import { BrandMark } from "./BrandMark";
import { ProfileAvatar } from "./ProfileAvatar";
import { primaryNavItems } from "./nav-items";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type AppNavProps = {
  activeKey: string;
  userName: string;
  userEmail?: string | undefined;
  userAvatarUrl?: string | undefined;
  notificationCount?: number | undefined;
};

const linkBase =
  "relative inline-flex h-16 items-center border-b-2 px-1 text-sm font-medium transition-colors";

/** Shared desktop + tablet top navigation for every authenticated Nexali page. */
export function AppNav({
  activeKey,
  userName,
  userEmail,
  userAvatarUrl,
  notificationCount = 0,
}: AppNavProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 hidden h-16 border-b border-outline-variant/40 bg-background/95 backdrop-blur-md md:block">
      <div className="mx-auto grid h-full max-w-[1200px] grid-cols-[auto_1fr_auto] items-center gap-3 px-4 lg:gap-4 lg:px-8">
        <Link to="/dashboard" aria-label="Nexali home" className="shrink-0">
          <BrandMark className="[&_span:nth-child(2)]:hidden lg:[&_span:nth-child(2)]:inline" />
        </Link>

        <nav
          aria-label="Primary"
          className="flex min-w-0 items-center justify-center gap-4 lg:gap-7"
        >
          {primaryNavItems.map((item) => {
            const isActive = item.key === activeKey;
            return (
              <Link
                key={item.key}
                to={item.to}
                className={cn(
                  linkBase,
                  isActive
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <span className="lg:hidden">{item.shortLabel ?? item.label}</span>
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            to="/notifications"
            aria-label={`Notifications${notificationCount ? `, ${notificationCount} unread` : ""}`}
            className={cn(
              "relative grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground",
              activeKey === "notifications" && "bg-surface-high text-primary",
            )}
          >
            <Bell className="h-[18px] w-[18px]" />
            {notificationCount > 0 && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </Link>
          <Link
            to="/settings"
            aria-label="Settings"
            className={cn(
              "grid h-9 w-9 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-high hover:text-foreground",
              activeKey === "settings" && "bg-surface-high text-primary",
            )}
          >
            <Settings className="h-[18px] w-[18px]" />
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Account menu for ${userName}`}
              className="ml-1 flex items-center gap-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ProfileAvatar name={userName} imageUrl={userAvatarUrl} size="sm" />
              <ChevronDown className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">
                  {userName}
                </span>
                {userEmail && (
                  <span className="block truncate text-xs font-normal text-muted-foreground">
                    {userEmail}
                  </span>
                )}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/profile">
                  <CircleUser className="h-4 w-4" /> Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/account">
                  <ShieldCheck className="h-4 w-4" /> Account
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
                <Link to="/signin">
                  <LogOut className="h-4 w-4" /> Sign Out
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
