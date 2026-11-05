-- Approved for implementation/staging only. Production execution requires separate approval.
-- Keep enum labels for decoder/rolling-read compatibility; constrain persisted roles to four.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';
SELECT pg_advisory_xact_lock(82173642);
LOCK TABLE "User" IN SHARE ROW EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "User") AND NOT EXISTS (
    SELECT 1 FROM "User" WHERE role IN ('ADMIN', 'SUPER_ADMIN') AND "isActive" AND status = 'ACTIVE'
  ) THEN RAISE EXCEPTION 'Role migration requires at least one active administrator'; END IF;
END $$;

INSERT INTO "AuditLog" (id, "actorId", action, entity, "entityId", metadata, "createdAt")
SELECT gen_random_uuid()::text, NULL, 'ROLE_MIGRATED', 'User', id,
       jsonb_build_object('previousRole', role::text, 'role', CASE role::text WHEN 'SUPER_ADMIN' THEN 'ADMIN' ELSE 'USER' END), NOW()
FROM "User" WHERE role IN ('SUPER_ADMIN', 'PATIENT');

UPDATE "User" SET role = 'ADMIN' WHERE role = 'SUPER_ADMIN';
UPDATE "User" SET role = 'USER' WHERE role = 'PATIENT';
ALTER TABLE "User" ADD CONSTRAINT "User_four_primary_roles_check"
  CHECK (role::text IN ('ADMIN', 'DOCTOR', 'RECEPTION', 'USER')) NOT VALID;
ALTER TABLE "User" VALIDATE CONSTRAINT "User_four_primary_roles_check";

CREATE FUNCTION protect_last_active_administrator() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.role::text = 'ADMIN' AND OLD."isActive" AND OLD.status::text = 'ACTIVE' THEN
    IF TG_OP = 'DELETE' OR NEW.role::text <> 'ADMIN' OR NOT NEW."isActive" OR NEW.status::text <> 'ACTIVE' THEN
      PERFORM pg_advisory_xact_lock(82173642);
      IF NOT EXISTS (SELECT 1 FROM "User" WHERE id <> OLD.id AND role::text = 'ADMIN' AND "isActive" AND status::text = 'ACTIVE') THEN
        RAISE EXCEPTION 'Cannot remove the last active administrator' USING ERRCODE = '23514';
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER "User_preserve_active_administrator"
  BEFORE UPDATE OF role, status, "isActive" OR DELETE ON "User"
  FOR EACH ROW EXECUTE FUNCTION protect_last_active_administrator();
COMMIT;
