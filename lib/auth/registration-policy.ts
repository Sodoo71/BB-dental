export function shouldAutoApproveRegistration(role: string, policy: unknown) {
  return role === "DOCTOR" && typeof policy === "object" && policy !== null &&
    "autoApproveDoctors" in policy && policy.autoApproveDoctors === true;
}
