import {
  ShoppingCart,
  Zap,
  Landmark,
  Car,
  UtensilsCrossed,
  Dumbbell,
  Home,
  Briefcase,
  type LucideIcon,
} from "lucide-react";

const KEYWORD_ICONS: Array<[RegExp, LucideIcon]> = [
  [/grocer|market/i, ShoppingCart],
  [/util|electric|power|water|internet|phone/i, Zap],
  [/income|salary|payout|paycheck|deposit/i, Landmark],
  [/transport|gas|fuel|uber|lyft|\bcar\b|auto/i, Car],
  [/dining|restaurant|coffee|cafe|food/i, UtensilsCrossed],
  [/health|fitness|gym|medical/i, Dumbbell],
  [/rent|housing|mortgage/i, Home],
  [/business|work|office/i, Briefcase],
];

const FALLBACK_ICONS: LucideIcon[] = [
  ShoppingCart,
  Zap,
  Landmark,
  Car,
  UtensilsCrossed,
  Dumbbell,
  Home,
  Briefcase,
];

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 31 + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

/**
 * A small, deterministic local icon per category name: a few common
 * keywords map to an intuitive icon, everything else picks consistently
 * from a fixed pool by name hash (same category, same icon, every time).
 * Never fetches an external merchant logo.
 */
export function getCategoryIcon(categoryName: string): LucideIcon {
  for (const [pattern, icon] of KEYWORD_ICONS) {
    if (pattern.test(categoryName)) return icon;
  }
  return FALLBACK_ICONS[hashString(categoryName) % FALLBACK_ICONS.length];
}

export type CategoryTone = "primary" | "success" | "warning" | "neutral";

const TONES: CategoryTone[] = ["primary", "success", "warning", "neutral"];

const TONE_ICON_CLASSES: Record<CategoryTone, string> = {
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  neutral: "text-muted-foreground",
};

const TONE_BADGE_CLASSES: Record<CategoryTone, string> = {
  primary: "border-primary/25 bg-primary/10 text-primary",
  success: "border-success/25 bg-success/10 text-success",
  warning: "border-warning/25 bg-warning/10 text-warning",
  neutral: "border-outline-variant bg-surface-high text-muted-foreground",
};

/**
 * A small, deterministic tone per category name (same category, same tone,
 * every time) -- matches Lovable's per-category tone variety instead of
 * collapsing every category to a single income/expense color. Purely a
 * local visual mapping, not fetched or stored anywhere.
 */
export function getCategoryTone(categoryName: string): CategoryTone {
  return TONES[hashString(categoryName) % TONES.length];
}

/** Icon-tile treatment: a neutral tile with only the icon glyph tone-colored, matching Lovable's CategoryIconTile. */
export function getCategoryIconClass(categoryName: string): string {
  return TONE_ICON_CLASSES[getCategoryTone(categoryName)];
}

/** Category badge treatment: tone-tinted border/background/text, matching Lovable's CategoryBadge. */
export function getCategoryBadgeClass(categoryName: string): string {
  return TONE_BADGE_CLASSES[getCategoryTone(categoryName)];
}
