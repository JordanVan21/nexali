import { Avatar, AvatarFallback, AvatarImage } from "./ui/avatar";
import { getInitials, cn } from "../lib/utils";

type ProfileAvatarProps = {
  /** Real profile.full_name, if set. */
  name?: string | null;
  /** Real Supabase Auth email, used only when no name is set yet. */
  email?: string | null;
  /** Real avatar_url (from useAvatar), if the user has uploaded one. */
  imageUrl?: string | null;
  className?: string;
  fallbackClassName?: string;
};

/**
 * Real avatar image when one exists; otherwise real initials derived from
 * the user's own name/email -- never a stock silhouette. Shared by the
 * Profile page and both desktop/mobile profile menus so the same person
 * gets the same fallback everywhere.
 */
export function ProfileAvatar({ name, email, imageUrl, className, fallbackClassName }: ProfileAvatarProps) {
  const initials = getInitials(name, email);
  return (
    <Avatar className={cn("border border-outline-variant", className)}>
      {imageUrl ? (
        <AvatarImage src={imageUrl} alt="" />
      ) : (
        <AvatarFallback className={cn("bg-surface-high text-xs font-semibold text-muted-foreground", fallbackClassName)}>
          {initials}
        </AvatarFallback>
      )}
    </Avatar>
  );
}
