/** Static marketing copy for the public Landing page. Not user/account data. */

export type LandingFeature = {
  icon: "transactions" | "aura" | "budgets" | "reports";
  title: string;
  description: string;
};

export const landingFeatures: LandingFeature[] = [
  {
    icon: "transactions",
    title: "Unified transactions",
    description:
      "Every purchase, transfer and payout lands in one searchable feed, auto-categorized so your ledger stays tidy without manual entry.",
  },
  {
    icon: "aura",
    title: "Aura, your AI co-pilot",
    description:
      "Ask Aura plain-language questions about your spending and get instant, data-backed answers pulled straight from your own accounts.",
  },
  {
    icon: "budgets",
    title: "Precision budgets",
    description:
      "Set granular limits for every category and get nudged before you overspend, with progress bars that update in real time.",
  },
  {
    icon: "reports",
    title: "Clear reports",
    description:
      "Monthly and yearly breakdowns turn raw numbers into trends you can actually act on — no spreadsheets required.",
  },
];

export type LandingStep = {
  title: string;
  description: string;
};

export const landingSteps: LandingStep[] = [
  {
    title: "Bring your activity together",
    description:
      "Add transactions manually or bring them in from your accounts. Everything lands in one searchable, auto-categorized feed.",
  },
  {
    title: "Set the limits that matter",
    description:
      "Create budgets per category, track progress as you spend, and see exactly how much room is left before the month ends.",
  },
  {
    title: "Ask Aura what changed",
    description:
      "Aura reads your own numbers and answers in plain language, so a spending spike never goes unexplained.",
  },
];

export type LandingFooterColumn = {
  title: string;
  links: { label: string; href: string }[];
};

export const landingFooterColumns: LandingFooterColumn[] = [
  {
    title: "Product",
    links: [
      { label: "Transactions", href: "/transactions" },
      { label: "Budgets", href: "/budgets" },
      { label: "Reports", href: "/reports" },
      { label: "Aura AI", href: "/assistant" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
      { label: "Contact", href: "#" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help center", href: "#" },
      { label: "Privacy policy", href: "#" },
      { label: "Terms of service", href: "#" },
    ],
  },
];
