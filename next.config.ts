import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@whiskeysockets/baileys", "@hapi/boom", "pino"],
  experimental: {
    serverActions: {
      // Allow dev tunnels (VS Code, DevTunnels, ngrok, etc.)
      allowedOrigins: [
        "localhost:3000",
        // DevTunnels pattern — add your specific subdomain if needed
        "https://8zcfbv37-3000.brs.devtunnels.ms/dashboard",
        "*.brs.devtunnels.ms",
        "*.devtunnels.ms",
        // ngrok
        "graduate-federal-reanalyze.ngrok-free.dev",
        "*.ngrok-free.app",
        "*.ngrok.io",
      ],
    },
  },
};

export default nextConfig;
