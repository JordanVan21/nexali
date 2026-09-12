/** Mock profile data — replace with real Nexali hooks on integration. */

export type MockUser = {
  name: string;
  email: string;
  avatarUrl?: string;
  initials: string;
  plan: string;
  memberSince: string;
  phone: string;
  location: string;
  currency: string;
  timezone: string;
};

export const mockUser: MockUser = {
  name: "Jordan Van",
  email: "jordan.van@nexali.app",
  initials: "JV",
  plan: "Nexali Plus",
  memberSince: "March 2024",
  phone: "+1 (415) 555-0142",
  location: "San Francisco, CA",
  currency: "USD ($)",
  timezone: "America/Los_Angeles",
};

export const mockUnreadNotifications = 3;
