import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Gera um servidor autocontido em .next/standalone — é o que o Docker roda.
  output: "standalone",

  // A otimização de imagens do Next exige o sharp compilado para a
  // plataforma do contêiner (musl, no Alpine). Como a única imagem é a
  // logo, servir o arquivo original evita essa dependência por completo.
  images: { unoptimized: true },
};

export default nextConfig;
