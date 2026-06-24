export type UserRole = "superadmin" | "principal" | "staff";

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  avatarUrl?: string;
  schoolId?: string;
  departmentId?: string;
}

export interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
}
