import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type ProfileAvatarProps = {
  name: string;
  imageUrl?: string | undefined;
  size?: "sm" | "md";
  className?: string;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function ProfileAvatar({ name, imageUrl, size = "md", className }: ProfileAvatarProps) {
  return (
    <Avatar
      className={cn(
        "border border-outline-variant",
        size === "sm" ? "h-8 w-8" : "h-9 w-9",
        className,
      )}
    >
      {imageUrl ? <AvatarImage src={imageUrl} alt="" /> : null}
      <AvatarFallback className="bg-surface-high text-xs font-semibold text-muted-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
