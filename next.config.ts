import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  // Shown in the sidebar footer; bump "version" in package.json on release.
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  // Dev only: let other devices on the LAN (phone / tablet testing) load the
  // dev server's scripts — Next blocks non-localhost origins by default, which
  // leaves the login form un-hydrated.
  allowedDevOrigins: ['192.168.1.7', '192.168.*.*'],
};

export default nextConfig;
