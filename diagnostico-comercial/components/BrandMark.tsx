import Image from "next/image";

interface Props {
  /** Texto alternativo da logo. */
  label?: string;
  /** Altura em pixels — a largura acompanha a proporção do arquivo. */
  height?: number;
  className?: string;
  priority?: boolean;
}

// Proporção original do arquivo: 1188 x 334.
const RATIO = 1188 / 334;

export default function BrandMark({
  label = "Simplifica",
  height = 34,
  className = "",
  priority = false,
}: Props) {
  return (
    <Image
      src="/logo-simplifica.png"
      alt={label}
      width={Math.round(height * RATIO)}
      height={height}
      priority={priority}
      className={`w-auto select-none ${className}`}
      style={{ height }}
    />
  );
}
