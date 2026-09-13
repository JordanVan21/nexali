import { Link } from "react-router-dom";
import { ChevronDown, User, ShieldCheck, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdownMenu";
import { useAvatar } from "../../features/profiles/useAvatar";
import { useUserInfo } from "../../shared/useUserId";
import { useSignOut } from "../../features/user/useSignOut";
import blankProfile from "../../assets/blank_profile_pic.jpg";

/**
 * Authenticated account menu: avatar + chevron trigger, Profile / Account /
 * Sign out items. Click-based and keyboard-accessible (Radix DropdownMenu),
 * replacing the old hover-only pattern. Settings is intentionally not
 * listed here; it has its own dedicated navbar control.
 */
export function ProfileMenu() {
  const { userId } = useUserInfo();
  const { data: avatarUrl } = useAvatar(userId);
  const signOut = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label="Account menu"
          className="flex items-center gap-1 rounded-full p-1 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <img
            src={avatarUrl || blankProfile}
            alt=""
            className="h-9 w-9 rounded-full object-cover ring-2 ring-outline-variant"
          />
          <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem asChild>
          <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
            <User className="h-4 w-4" aria-hidden="true" />
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
