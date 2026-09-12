import { Link } from "@tanstack/react-router";

import { BrandMark } from "./BrandMark";
import { MobileProfileMenu } from "./MobileProfileMenu";

export type MobileTopBarProps = {
  userName: string;
  userEmail?: string | undefined;
  userAvatarUrl?: string | undefined;
  notificationCount?: number | undefined;
};

export function MobileTopBar({
  userName,
  userEmail,
  userAvatarUrl,
  notificationCount = 0,
}: MobileTopBarProps) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-outline-variant/40 bg-background/95 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md md:hidden">
      <div className="grid h-14 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4">
        <Link to="/dashboard" aria-label="Nexali home" className="min-w-0">
          <BrandMark />
        </Link>
        <MobileProfileMenu
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          notificationCount={notificationCount}
        />
      </div>
    </header>
  );
}
