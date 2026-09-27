import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  // Allow webpack config from next-pwa with Turbopack
  turbopack: {},
  // Allow testing the dev server from phones on the local network
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.local"],
};

const pwaConfig = withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

export default pwaConfig(nextConfig);
