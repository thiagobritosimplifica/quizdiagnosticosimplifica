import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor autocontido em .next/standalone — é o que o Docker roda.
  output: "standalone",
};

export default nextConfig;
