import { Link } from "react-router-dom";
import { CircleUser, ShieldCheck, Bell, Settings as SettingsIcon, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdownMenu";
import { useAvatar } from "../../features/profiles/useAvatar";
import { useProfile } from "../../features/profiles/useProfile";
import { useUserInfo } from "../../shared/useUserId";
import { useSignOut } from "../../features/user/useSignOut";
import { ProfileAvatar } from "../ProfileAvatar";

const itemClass = "flex min-h-11 items-center gap-3 cursor-pointer text-[15px] [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0";

/**
 * Mobile equivalent of ProfileMenu: the sole entry point (from the mobile
 * top bar's avatar) for Profile, Account, Notifications, Settings, and Sign
 * out on phone-width layouts, where those don't get their own standalone
 * icons (avoiding duplicate controls with the bottom nav). Grouped
 * Profile/Account, then Notifications/Settings, then Sign out.
 */
export function MobileProfileMenu() {
  const { userId, email } = useUserInfo();
  const { data: avatarUrl } = useAvatar(userId);
  const { data: profile } = useProfile(userId);
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ProfileAvatar name={profile?.full_name} email={email} imageUrl={avatarUrl} className="h-8 w-8 ring-2 ring-outline-variant" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 max-w-[calc(100vw-1.5rem)] border-outline-variant/60 bg-card">
        {(profile?.full_name || email) && (
          <>
            <DropdownMenuLabel className="font-normal">
              {profile?.full_name && <p className="text-sm font-semibold text-foreground">{profile.full_name}</p>}
              {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/profile">
            <CircleUser aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/account">
            <ShieldCheck aria-hidden="true" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/notifications">
            <Bell aria-hidden="true" />
            Notifications
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={itemClass}>
          <Link to="/settings">
            <SettingsIcon aria-hidden="true" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void signOut()}
          className={`${itemClass} text-destructive focus:text-destructive`}
        >
          <LogOut aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
