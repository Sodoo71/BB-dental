export function environmentIssues(env: Record<string, string | undefined>) {
  const issues: string[] = [];
  try {
    const database = new URL(env.DATABASE_URL || "");
    if (!["postgres:", "postgresql:"].includes(database.protocol)) issues.push("DATABASE_URL must use PostgreSQL.");
  } catch { issues.push("DATABASE_URL is required and must be a valid PostgreSQL URL."); }
  if (!env.AUTH_SECRET || env.AUTH_SECRET.length < 32) issues.push("AUTH_SECRET must contain at least 32 characters.");
  if (env.APP_URL) {
    try {
      const url = new URL(env.APP_URL);
      if (url.origin !== env.APP_URL || (env.NODE_ENV === "production" && url.protocol !== "https:")) issues.push("APP_URL must be an exact origin (HTTPS in production).");
    } catch { issues.push("APP_URL must be a valid origin."); }
  } else if (env.NODE_ENV === "production") issues.push("APP_URL is required for production configuration checks.");
  return issues;
}
