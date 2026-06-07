import type { AuthenticatedUser } from "../../types/express.js";

export type PageAction = {
  key: "create" | "read" | "update" | "delete" | "join" | "cancel" | "export" | "override" | "mark";
  permission: string;
};

export type NavigationPage = {
  key: string;
  label: string;
  path: string;
  icon: string;
  section: "main" | "teaching" | "operations" | "account";
  roles: string[];
  anyPermissions: string[];
  actions: PageAction[];
};

export type NavigationPolicyResponse = {
  defaultRoute: string;
  pages: NavigationPage[];
};

const pages: NavigationPage[] = [
  {
    key: "admin.dashboard",
    label: "Dashboard",
    path: "/admin/dashboard",
    icon: "grid",
    section: "main",
    roles: ["admin"],
    anyPermissions: ["user.view", "class.view", "report.view"],
    actions: [{ key: "read", permission: "report.view" }]
  },
  {
    key: "admin.users",
    label: "Users",
    path: "/admin/users",
    icon: "users",
    section: "operations",
    roles: ["admin"],
    anyPermissions: ["user.view"],
    actions: [
      { key: "read", permission: "user.view" },
      { key: "create", permission: "user.create" },
      { key: "update", permission: "user.update" },
      { key: "delete", permission: "user.deactivate" }
    ]
  },
  {
    key: "admin.roles",
    label: "Roles",
    path: "/admin/roles",
    icon: "shield",
    section: "operations",
    roles: ["admin"],
    anyPermissions: ["role.view", "permission.view"],
    actions: [
      { key: "read", permission: "role.view" },
      { key: "update", permission: "permission.view" }
    ]
  },
  {
    key: "admin.assignments",
    label: "Assignments",
    path: "/admin/assignments",
    icon: "link",
    section: "operations",
    roles: ["admin"],
    anyPermissions: ["teacher.update", "student.update"],
    actions: [
      { key: "read", permission: "teacher.view" },
      { key: "create", permission: "teacher.update" },
      { key: "update", permission: "teacher.update" }
    ]
  },
  {
    key: "classes",
    label: "Classes",
    path: "/admin/classes",
    icon: "calendar",
    section: "main",
    roles: ["admin"],
    anyPermissions: ["class.view"],
    actions: [
      { key: "read", permission: "class.view" },
      { key: "create", permission: "class.create" },
      { key: "update", permission: "class.update" },
      { key: "cancel", permission: "class.cancel" },
      { key: "join", permission: "class.join" },
      { key: "override", permission: "class.override_conflict" }
    ]
  },
  {
    key: "attendance",
    label: "Attendance",
    path: "/admin/attendance",
    icon: "check",
    section: "main",
    roles: ["admin"],
    anyPermissions: ["attendance.view"],
    actions: [
      { key: "read", permission: "attendance.view" },
      { key: "mark", permission: "attendance.mark" },
      { key: "override", permission: "attendance.override" }
    ]
  },
  {
    key: "credits",
    label: "Credits",
    path: "/admin/credits",
    icon: "credit",
    section: "operations",
    roles: ["admin"],
    anyPermissions: ["credits.view"],
    actions: [
      { key: "read", permission: "credits.view" },
      { key: "create", permission: "credits.adjust" },
      { key: "update", permission: "credits.adjust" },
      { key: "override", permission: "credits.refund" }
    ]
  },
  {
    key: "tickets",
    label: "Tickets",
    path: "/admin/tickets",
    icon: "ticket",
    section: "operations",
    roles: ["admin"],
    anyPermissions: ["ticket.view"],
    actions: [
      { key: "read", permission: "ticket.view" },
      { key: "create", permission: "ticket.create" },
      { key: "update", permission: "ticket.reply" },
      { key: "delete", permission: "ticket.resolve" },
      { key: "override", permission: "ticket.escalate" }
    ]
  },
  {
    key: "notifications",
    label: "Notifications",
    path: "/admin/notifications",
    icon: "bell",
    section: "operations",
    roles: ["admin"],
    anyPermissions: ["notification.view", "email_template.view"],
    actions: [
      { key: "read", permission: "notification.view" },
      { key: "create", permission: "email_template.create" },
      { key: "update", permission: "notification.update" }
    ]
  },
  {
    key: "teacher.dashboard",
    label: "Dashboard",
    path: "/teacher/dashboard",
    icon: "grid",
    section: "main",
    roles: ["teacher"],
    anyPermissions: ["teacher.view", "class.view"],
    actions: [{ key: "read", permission: "class.view" }]
  },
  {
    key: "teacher.classes",
    label: "My Classes",
    path: "/teacher/classes",
    icon: "calendar",
    section: "teaching",
    roles: ["teacher"],
    anyPermissions: ["class.view"],
    actions: [
      { key: "read", permission: "class.view" },
      { key: "join", permission: "class.join" },
      { key: "mark", permission: "attendance.mark" }
    ]
  },
  {
    key: "teacher.students",
    label: "My Students",
    path: "/teacher/students",
    icon: "users",
    section: "teaching",
    roles: ["teacher"],
    anyPermissions: ["student.view"],
    actions: [{ key: "read", permission: "student.view" }]
  },
  {
    key: "homework",
    label: "Homework",
    path: "/teacher/homework",
    icon: "doc",
    section: "teaching",
    roles: ["teacher"],
    anyPermissions: ["homework.view"],
    actions: [
      { key: "read", permission: "homework.view" },
      { key: "create", permission: "homework.create" },
      { key: "update", permission: "homework.review" }
    ]
  },
  {
    key: "reports",
    label: "Reports",
    path: "/teacher/reports",
    icon: "chart",
    section: "account",
    roles: ["teacher"],
    anyPermissions: ["report.view"],
    actions: [
      { key: "read", permission: "report.view" },
      { key: "export", permission: "report.export" }
    ]
  },
  {
    key: "student.dashboard",
    label: "Dashboard",
    path: "/student/dashboard",
    icon: "grid",
    section: "main",
    roles: ["student"],
    anyPermissions: ["class.view"],
    actions: [{ key: "read", permission: "class.view" }]
  },
  {
    key: "student.classes",
    label: "My Classes",
    path: "/student/classes",
    icon: "calendar",
    section: "main",
    roles: ["student"],
    anyPermissions: ["class.view"],
    actions: [
      { key: "read", permission: "class.view" },
      { key: "join", permission: "class.join" },
      { key: "cancel", permission: "class.request_cancel" }
    ]
  },
  {
    key: "student.credits",
    label: "Credits",
    path: "/student/credits",
    icon: "credit",
    section: "main",
    roles: ["student"],
    anyPermissions: ["credits.view"],
    actions: [{ key: "read", permission: "credits.view" }]
  },
  {
    key: "student.certificates",
    label: "Certificates",
    path: "/student/certificates",
    icon: "award",
    section: "account",
    roles: ["student"],
    anyPermissions: ["certificate.view"],
    actions: [{ key: "read", permission: "certificate.view" }]
  }
];

export function getNavigationPolicy(user: AuthenticatedUser): NavigationPolicyResponse {
  const userRoles = new Set(user.roles);
  const userPermissions = new Set(user.permissions);
  const visiblePages = pages.filter(
    (page) =>
      page.roles.some((role) => userRoles.has(role)) &&
      page.anyPermissions.some((permission) => userPermissions.has(permission))
  );
  const defaultRoute = getDefaultRoute(user, visiblePages);

  return {
    defaultRoute,
    pages: visiblePages.map((page) => ({
      ...page,
      actions: page.actions.filter((action) => userPermissions.has(action.permission))
    }))
  };
}

function getDefaultRoute(user: AuthenticatedUser, visiblePages: NavigationPage[]): string {
  if (user.roles.includes("admin")) {
    return visiblePages.find((page) => page.path === "/admin/dashboard")?.path ?? "/admin/classes";
  }

  if (user.roles.includes("teacher")) {
    return visiblePages.find((page) => page.path === "/teacher/dashboard")?.path ?? "/teacher/classes";
  }

  if (user.roles.includes("student")) {
    return visiblePages.find((page) => page.path === "/student/dashboard")?.path ?? "/student/classes";
  }

  return visiblePages[0]?.path ?? "/api/health";
}
