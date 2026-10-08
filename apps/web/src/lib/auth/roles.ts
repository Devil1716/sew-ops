import type { Role } from "@sew-ops/shared";

export type Area = "admin" | "manager" | "operator";

export function canAccessArea(role: Role, area: Area): boolean {
  if (role === "admin") return true;
  if (role === "manager") return area === "manager";
  if (role === "operator") return area === "operator";
  return false;
}

export function roleHome(role: Role): string {
  switch (role) {
    case "admin":
      return "/admin/factories";
    case "manager":
      return "/manager/dashboard";
    case "operator":
      return "/operator";
  }
}
