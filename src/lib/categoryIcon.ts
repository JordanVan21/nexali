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
