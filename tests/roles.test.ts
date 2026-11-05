import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  primaryRoles,
  normalizeRole,
  normalizeUserRole,
  getDashboardRouteForRole,
} from "../lib/roles";
import { roleSchema, registerSchema } from "../lib/validation/auth";
import { hasPermission, mayManageUser } from "../lib/permissions/policy";

describe("approved four-role model", () => {
  it("exposes exactly four assignable primary roles", () => {
    assert.deepEqual(primaryRoles, ["ADMIN", "DOCTOR", "RECEPTION", "USER"]);
    for (const role of primaryRoles) assert.equal(roleSchema.parse(role), role);
    for (const role of ["SUPER_ADMIN", "PATIENT", "INVALID"])
      assert.equal(roleSchema.safeParse(role).success, false);
  });
  it("normalizes legacy reads and denies unknown roles", () => {
    assert.equal(normalizeRole("SUPER_ADMIN"), "ADMIN");
    assert.equal(normalizeRole("PATIENT"), "USER");
    assert.equal(normalizeRole("UNKNOWN"), null);
    assert.deepEqual(normalizeUserRole({ id: "same", role: "SUPER_ADMIN" }), {
      id: "same",
      role: "ADMIN",
    });
  });
  it("keeps public users out of clinical and management access", () => {
    const user = {
      role: "USER" as const,
      status: "ACTIVE" as const,
      isActive: true,
    };
    for (const permission of [
      "users:manage",
      "settings:manage",
      "appointments:manage",
      "patients:read",
      "clinical:own",
    ] as const)
      assert.equal(hasPermission(user, permission), false);
    assert.equal(getDashboardRouteForRole("USER"), "/login");
    assert.equal(getDashboardRouteForRole("PATIENT"), "/login");
    for (const role of ["USER", "ADMIN", "SUPER_ADMIN"])
      assert.equal(
        registerSchema.safeParse({
          name: "Public",
          email: "public@example.test",
          password: "safe-test-password",
          role,
        }).success,
        false,
      );
  });
  it("permits equal administrators and still prevents self-management", () => {
    assert.equal(
      mayManageUser(
        { id: "a", role: "ADMIN" },
        { id: "b", role: "SUPER_ADMIN" },
      ),
      true,
    );
    assert.equal(
      mayManageUser(
        { id: "a", role: "SUPER_ADMIN" },
        { id: "b", role: "ADMIN" },
      ),
      true,
    );
    assert.equal(
      mayManageUser(
        { id: "a", role: "ADMIN" },
        { id: "a", role: "SUPER_ADMIN" },
      ),
      false,
    );
  });
});
