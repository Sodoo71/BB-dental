-- Expand separately: PostgreSQL must commit an enum value before it can be used.
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'USER';
