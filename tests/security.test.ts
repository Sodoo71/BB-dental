import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scryptSync } from "node:crypto";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "../lib/auth/password";
import {
  newSessionToken,
  sessionTokenHash,
  validSessionToken,
} from "../lib/auth/session-token";
import {
  hasPermission,
  mayManageUser,
  type StaffRole,
  type AccountState,
} from "../lib/permissions/policy";
import { isSameOriginMutation } from "../lib/security/origin";
import { detectImageMime } from "../lib/security/image";
import { registerSchema, passwordSchema } from "../lib/validation/auth";

describe("password compatibility", () => {
  it("hashes with unique salts and verifies only the correct password", async () => {
    const a = await hashPassword("a strong test password");
    const b = await hashPassword("a strong test password");
    assert.notEqual(a, b);
    assert.equal(await verifyPassword("a strong test password", a), true);
    assert.equal(await verifyPassword("wrong password", a), false);
  });
  it("accepts legacy scrypt and bcrypt reset hashes", async () => {
    const old = `legacy-salt:${scryptSync("legacy", "legacy-salt", 64).toString("hex")}`;
    assert.equal(await verifyPassword("legacy", old), true);
    assert.equal(
      await verifyPassword("legacy", await bcrypt.hash("legacy", 10)),
      true,
    );
  });
  it("rejects malformed and oversized credentials", async () => {
    for (const hash of ["", "a:abcd", "a:zz", "a:b:c"])
      assert.equal(await verifyPassword("password", hash), false);
    assert.equal(await verifyPassword("x".repeat(257), "bad"), false);
  });
});

describe("permissions", () => {
  const user = (
    role: StaffRole,
    status: AccountState = "ACTIVE",
    isActive = true,
  ) => ({ role, status, isActive });
  it("grants administrators management without granting it to reception or doctors", () => {
    for (const role of ["ADMIN", "SUPER_ADMIN"] as const)
      assert.equal(hasPermission(user(role), "users:manage"), true);
    for (const role of ["RECEPTION", "DOCTOR", "PATIENT"] as const)
      assert.equal(hasPermission(user(role), "users:manage"), false);
    assert.equal(hasPermission(user("RECEPTION"), "appointments:manage"), true);
    assert.equal(hasPermission(user("DOCTOR"), "clinical:own"), true);
    assert.equal(hasPermission(user("PATIENT"), "patients:read"), false);
  });
  it("denies every inactive state and unauthenticated callers", () => {
    assert.equal(hasPermission(null, "users:manage"), false);
    for (const status of ["PENDING", "REJECTED", "SUSPENDED"] as const)
      assert.equal(hasPermission(user("ADMIN", status), "users:manage"), false);
    assert.equal(
      hasPermission(user("ADMIN", "ACTIVE", false), "users:manage"),
      false,
    );
  });
  it("prevents self-deactivation and manipulation of superior administrators", () => {
    const actor = { id: "a", role: "ADMIN" as const };
    assert.equal(mayManageUser(actor, actor), false);
    assert.equal(mayManageUser(actor, { id: "b", role: "SUPER_ADMIN" }), false);
    assert.equal(
      mayManageUser(actor, { id: "b", role: "DOCTOR" }, "SUPER_ADMIN"),
      false,
    );
    assert.equal(
      mayManageUser(actor, { id: "b", role: "DOCTOR" }, "RECEPTION"),
      true,
    );
    assert.equal(
      mayManageUser(
        { id: "a", role: "RECEPTION" },
        { id: "b", role: "DOCTOR" },
      ),
      false,
    );
  });
});

describe("browser request protection", () => {
  it("requires exact origin for mutations including missing/null origins", () => {
    const target = "https://clinic.example/api/admin/users";
    assert.equal(
      isSameOriginMutation(
        "POST",
        "https://clinic.example",
        target,
        "same-origin",
      ),
      true,
    );
    assert.equal(
      isSameOriginMutation(
        "POST",
        "https://evil.example",
        target,
        "cross-site",
      ),
      false,
    );
    assert.equal(
      isSameOriginMutation(
        "POST",
        "https://clinic.example.evil.test",
        target,
        null,
      ),
      false,
    );
    assert.equal(isSameOriginMutation("POST", null, target, null), false);
    assert.equal(isSameOriginMutation("POST", "null", target, null), false);
    assert.equal(isSameOriginMutation("GET", null, target, null), true);
  });
});

describe("session tokens", () => {
  it("uses unpredictable opaque tokens and nonreversible stored digests", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    assert.equal(validSessionToken(a), true);
    assert.notEqual(a, b);
    assert.notEqual(sessionTokenHash(a), a);
    assert.equal(validSessionToken("user-id.legacy-signature"), false);
  });
});

describe("registration validation", () => {
  const input = {
    name: "Staff Name",
    email: " STAFF@EXAMPLE.COM ",
    password: "a sufficiently long password",
  };
  it("normalizes identity and permits only staff enrollment roles", () => {
    assert.equal(registerSchema.parse(input).email, "staff@example.com");
    assert.equal(
      registerSchema.parse({ ...input, role: "RECEPTION" }).role,
      "RECEPTION",
    );
    for (const role of ["ADMIN", "SUPER_ADMIN", "PATIENT"])
      assert.equal(registerSchema.safeParse({ ...input, role }).success, false);
  });
  it("rejects short passwords and malformed email", () => {
    assert.equal(passwordSchema.safeParse("short").success, false);
    assert.equal(
      registerSchema.safeParse({ ...input, email: "invalid" }).success,
      false,
    );
  });
});

describe("public image upload validation", () => {
  it("rejects SVG, HTML, renamed files and short payloads", () => {
    assert.equal(
      detectImageMime(Buffer.from('<svg onload="alert(1)"></svg>')),
      null,
    );
    assert.equal(
      detectImageMime(Buffer.from("<!doctype html><script>bad</script>")),
      null,
    );
    assert.equal(detectImageMime(Buffer.from([255, 216, 255])), null);
  });
  it("recognizes allowlisted raster headers", () => {
    assert.equal(
      detectImageMime(Buffer.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0])),
      "image/jpeg",
    );
    assert.equal(
      detectImageMime(
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]),
      ),
      "image/png",
    );
    assert.equal(detectImageMime(Buffer.from("RIFF0000WEBP")), "image/webp");
  });
});

describe("server session expiry and revocation", () => {
  it("rejects expired, deleted and disabled-account sessions", async () => {
    const { activeSessionUser } = await import("../lib/auth/session-state");
    const now = new Date("2026-09-24T12:00:00Z");
    const user = { id: "staff", status: "ACTIVE", isActive: true };
    assert.equal(
      activeSessionUser({ user, expiresAt: new Date(now.getTime() + 1) }, now),
      user,
    );
    assert.equal(activeSessionUser({ user, expiresAt: now }, now), null);
    assert.equal(activeSessionUser(null, now), null);
    for (const status of ["PENDING", "REJECTED", "SUSPENDED"]) {
      assert.equal(
        activeSessionUser(
          {
            user: { ...user, status },
            expiresAt: new Date(now.getTime() + 1000),
          },
          now,
        ),
        null,
      );
    }
    assert.equal(
      activeSessionUser(
        {
          user: { ...user, isActive: false },
          expiresAt: new Date(now.getTime() + 1000),
        },
        now,
      ),
      null,
    );
  });
});
