// src/lib/roles.ts — FONTE ÚNICA de roles do sistema.
// Emitidos pelo backend: superadmin, manager, operator (W2-10). citizen = ausência de claim.
export const ROLES = {
  SUPERADMIN: 'superadmin',
  MANAGER: 'manager',
  OPERATOR: 'operator',
  CITIZEN: 'citizen',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles com acesso à área administrativa. */
export const STAFF_ROLES: readonly Role[] = [ROLES.SUPERADMIN, ROLES.MANAGER, ROLES.OPERATOR];

/** Roles que podem acessar o painel /admin (mesmo conjunto hoje; separado por clareza). */
export const ADMIN_ROUTE_ROLES: readonly Role[] = STAFF_ROLES;

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Destino canônico pós-login/pós-negação por role. */
export function getHomeForRole(role: string | null | undefined): string {
  if (role === ROLES.SUPERADMIN) return '/superadmin';
  if (isStaffRole(role)) return '/admin/dashboard';
  return '/app/inicio';
}
