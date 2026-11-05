import "dotenv/config";
import { environmentIssues } from "../lib/config";
const issues = environmentIssues(process.env);
if (issues.length) {
  for (const issue of issues) console.error(issue);
  process.exitCode = 1;
} else console.info("Required configuration is present. Secret values were not printed. Provider delivery and database connectivity still require verification.");
