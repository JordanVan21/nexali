import { Link } from "@tanstack/react-router";

import { primaryNavItems } from "./nav-items";
import { cn } from "@/lib/utils";

export type MobileBottomNavProps = {
  activeKey: string;
};

const itemClass =
  "flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-lg px-0.5 text-[10px] font-medium leading-tight transition-colors active:bg-surface-high min-[360px]:text-[11px]";

export function MobileBottomNav({ activeKey }: MobileBottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-outline-variant/40 bg-card/95 pb-safe backdrop-blur-md md:hidden"
    >
      <ul className="grid grid-cols-5 items-stretch gap-0 px-1 pt-1">
        {primaryNavItems.map((item) => {
          const isActive = item.key === activeKey;
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex min-w-0">
              <Link
                to={item.to}
                className={cn(itemClass, isActive ? "text-primary" : "text-muted-foreground")}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-[22px] w-[22px] shrink-0" />
                <span className="w-full truncate text-center">
                  {item.key === "transactions" ? "Activity" : item.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
