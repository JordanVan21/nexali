import { Link } from "@tanstack/react-router";
import { Bell, CircleUser, LogOut, Settings, ShieldCheck } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ProfileAvatar } from "./ProfileAvatar";

export type MobileProfileMenuProps = {
  userName: string;
  userEmail?: string | undefined;
  userAvatarUrl?: string | undefined;
  notificationCount?: number | undefined;
};

const entries = [
  { key: "profile", label: "Profile", icon: CircleUser, to: "/profile" },
  { key: "account", label: "Account", icon: ShieldCheck, to: "/account" },
  { key: "notifications", label: "Notifications", icon: Bell, to: "/notifications" },
  { key: "settings", label: "Settings", icon: Settings, to: "/settings" },
] as const;

export function MobileProfileMenu({
  userName,
  userEmail,
  userAvatarUrl,
  notificationCount = 0,
}: MobileProfileMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Account menu for ${userName}`}
        className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring active:bg-surface-high"
      >
        <ProfileAvatar name={userName} imageUrl={userAvatarUrl} size="sm" />
        {notificationCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-primary"
          />
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-56 max-w-[calc(100vw-1.5rem)] border-outline-variant/60 bg-card"
      >
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
          {userEmail ? (
            <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
          ) : null}
        </div>
        <DropdownMenuSeparator />
        {entries.map(({ key, label, icon: Icon, to }) => (
          <DropdownMenuItem key={key} asChild className="min-h-11 gap-3 text-[15px]">
            <Link to={to}>
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1">{label}</span>
              {key === "notifications" && notificationCount > 0 ? (
                <span className="numeric rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {notificationCount}
                </span>
              ) : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          asChild
          className="min-h-11 gap-3 text-[15px] text-destructive focus:text-destructive"
        >
          <Link to="/signin">
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
