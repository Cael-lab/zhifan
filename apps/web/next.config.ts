import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Windows local startup uses next start; standalone tracing needs symlink privileges.
  output: process.platform === "win32" ? undefined : "standalone",
  transpilePackages: ["@luxalgo/journal-core", "@luxalgo/journal-importers"],
  serverExternalPackages: ["better-sqlite3"],
  // Runtime journal files belong on the user's disk, never in a deployable bundle.
  outputFileTracingExcludes: {
    "/*": ["./data/**/*", "../../outputs/**/*", "../../.runtime-backup*/**/*", "../../.qa/**/*"],
  },
};

export default nextConfig;
