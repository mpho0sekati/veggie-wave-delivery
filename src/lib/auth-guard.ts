/**
 * Auth Guard Utilities
 * Protect routes and enforce buyer/trader role separation
 */

import { useSession } from "./use-session";

export type UserRole = "buyer" | "trader" | "unspecified" | null;

/**
 * Get user's role from session
 * Reads from Supabase metadata if available, falls back to localStorage
 */
export function getUserRole(): UserRole {
  if (typeof window === "undefined") return null;

  try {
    const roleJson = window.localStorage.getItem("veggie-user-role");
    return (roleJson as UserRole) || null;
  } catch {
    return null;
  }
}

export function setUserRole(role: Exclude<UserRole, null>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("veggie-user-role", JSON.stringify(role));
    window.dispatchEvent(new CustomEvent("role-changed", { detail: { role } }));
  } catch {
    console.error("Failed to save user role");
  }
}

export function clearUserRole() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem("veggie-user-role");
    window.dispatchEvent(new CustomEvent("role-changed", { detail: { role: null } }));
  } catch {
    console.error("Failed to clear user role");
  }
}

/**
 * Hook to check auth status and role
 * Use in components that need auth protection
 */
export function useAuthGuard() {
  const session = useSession();
  const role = session.role;
  const isAuthenticated = Boolean(session.userId);
  const isOnboarded = role !== null && role !== "unspecified";

  return {
    isAuthenticated,
    isOnboarded,
    role,
    userId: session.userId,
    needs: {
      auth: !isAuthenticated,
      onboarding: isAuthenticated && !isOnboarded,
    },
  };
}
