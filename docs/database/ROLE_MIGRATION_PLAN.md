# Four-role migration proposal — not implemented or approved

The application currently uses SUPER_ADMIN, ADMIN, DOCTOR, RECEPTION and PATIENT. No values or permissions were changed in this branch.

Read-only inventory on 2026-11-05 found two active SUPER_ADMIN accounts, four active and one suspended DOCTOR account, one active RECEPTION account, and no ADMIN/PATIENT accounts. Recheck this inventory immediately before migration.

## Proposed mapping

| V1 | V2 | Decision |
| --- | --- | --- |
| SUPER_ADMIN | ADMIN | Preserve clinic administration and account access for both existing administrators |
| ADMIN | ADMIN | Preserve administration; review the loss of superior-admin distinction |
| DOCTOR | DOCTOR | Preserve account state, doctor relationship and clinical scope |
| RECEPTION | RECEPTION | Preserve front-desk access and clinical field restrictions |
| PATIENT | USER | Preserve account state and identifiers; no internal dashboard access |

Removing SUPER_ADMIN removes the current superior-admin protection. Proposed replacement: ADMIN accounts cannot deactivate themselves, and transactions must preserve at least one active administrator. Equal-admin management needs explicit clinic approval; the existing rule currently distinguishes super administrators.

## Execution proposal

After approval, implement compatibility code accepting old and new stored values during deployment. Rehearse enum/data conversion on a restored staging copy; preserve IDs, passwords, account states, doctor relationships and audits. Update schema, API validators, permission policy, dashboards, bootstrap, seed guards and tests together. Verify both existing administrator accounts can sign in. Retire legacy enum values only after all application instances have been updated, verification succeeds and rollback is reviewed.

Do not apply destructive enum changes to the only production database. No executable role-conversion migration was generated without staging or approval.

USER appointment ownership needs an approved authentication mechanism. The user explicitly declined OTP and requested phone typing confirmation instead. That confirmation cannot authorize historical appointment lookup, cancellation or rescheduling. Such public account workflows remain pending a secure ownership design.
