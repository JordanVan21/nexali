import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, LogOut } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "../ui/sheet";
import { Button } from "../ui/button";
import {
  mobileMenuPrimaryRoutes,
  mobileMenuSecondaryRoutes,
  isRouteActive,
} from "../../lib/routes";
import { useSignOut } from "../../features/user/useSignOut";
import { cn } from "../../lib/utils";

const defaultTrigger = (
  <Button variant="ghost" size="icon" aria-label="Open menu" className="text-foreground">
    <Menu className="h-5 w-5" aria-hidden="true" />
  </Button>
);

type MobileMenuProps = {
  /** Custom trigger element (e.g. the bottom nav's "More" tab). Defaults to a hamburger button. */
  trigger?: ReactNode;
};

/**
 * Mobile menu: one shared Sheet listing every destination, grouped
 * Primary / Account and utilities / Other (sign out). Opened from the
 * MobileHeader hamburger and from the bottom nav's "More" tab, each with
 * its own trigger but identical content and ordering.
 */
export function MobileMenu({ trigger = defaultTrigger }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const signOut = useSignOut();

  const close = () => setOpen(false);

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      active
        ? "bg-primary text-primary-foreground"
        : "text-foreground/90 hover:bg-accent/40"
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-80 flex-col overflow-y-auto pt-[calc(1.5rem+env(safe-area-inset-top))] pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
      >
        <SheetHeader>
          <SheetTitle className="text-left">Nexali</SheetTitle>
          <SheetDescription className="text-left">
            Navigate the app and manage your account
          </SheetDescription>
        </SheetHeader>

        <nav aria-label="Mobile" className="mt-6 flex flex-1 flex-col gap-6">
          <div className="space-y-1">
            <h3 className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Menu
            </h3>
            {mobileMenuPrimaryRoutes.map((route) => {
              const active = isRouteActive(location.pathname, route.path);
              const Icon = route.icon;
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {route.label}
                </Link>
              );
            })}
          </div>

          <div className="space-y-1 border-t border-border pt-4">
            <h3 className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Account and utilities
            </h3>
            {mobileMenuSecondaryRoutes.map((route) => {
              const active = isRouteActive(location.pathname, route.path);
              const Icon = route.icon;
              return (
                <Link
                  key={route.path}
                  to={route.path}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {route.label}
                </Link>
              );
            })}
          </div>

          <div className="mt-auto space-y-1 border-t border-border pt-4">
            <h3 className="px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Other
            </h3>
            <button
              type="button"
              onClick={() => {
                close();
                void signOut();
              }}
              className={cn(linkClass(false), "w-full text-left text-destructive")}
            >
              <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
              Sign out
            </button>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
