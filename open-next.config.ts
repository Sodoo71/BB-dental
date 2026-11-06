import { defineCloudflareConfig } from "@opennextjs/cloudflare";

const config = defineCloudflareConfig({});

// OpenNext invokes this command instead of recursively calling `bun run build`.
config.buildCommand = "bun run build:next";

export default config;
