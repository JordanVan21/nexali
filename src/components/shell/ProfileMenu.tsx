import { Link } from "react-router-dom";
import { ChevronDown, CircleUser, ShieldCheck, LogOut } from "lucide-react";
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

/**
 * Authenticated account menu: avatar + chevron trigger, Profile / Account /
 * Sign out items. Click-based and keyboard-accessible (Radix DropdownMenu),
 * replacing the old hover-only pattern. Settings is intentionally not
 * listed here; it has its own dedicated navbar control.
 */
export function ProfileMenu() {
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
          className="ml-1 flex items-center gap-1 rounded-full p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <ProfileAvatar
            name={profile?.full_name}
            email={email}
            imageUrl={avatarUrl}
            className="h-9 w-9 ring-2 ring-outline-variant lg:h-10 lg:w-10 xl:h-11 xl:w-11"
          />
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {(profile?.full_name || email) && (
          <>
            <DropdownMenuLabel className="font-normal">
              {profile?.full_name && <p className="text-sm font-semibold text-foreground">{profile.full_name}</p>}
              {email && <p className="truncate text-xs text-muted-foreground">{email}</p>}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
            <CircleUser className="h-4 w-4" aria-hidden="true" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link to="/account" className="flex items-center gap-2 cursor-pointer">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => void signOut()}
          className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
