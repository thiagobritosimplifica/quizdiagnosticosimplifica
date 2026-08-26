import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Diagnóstico do Atendimento Comercial | Simplifica",
  description:
    "Responda 10 perguntas rápidas e descubra se o seu atendimento está convertendo oportunidades em clientes ou deixando dinheiro na mesa.",
  openGraph: {
    title: "Seu atendimento comercial está fazendo você perder vendas?",
    description:
      "Diagnóstico gratuito em menos de 3 minutos. Descubra o nível do seu atendimento comercial e os principais gargalos.",
    type: "website",
    locale: "pt_BR",
    siteName: "Simplifica",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#04070f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${geist.variable} h-full`}>
      <body className="min-h-full">
        <div className="ambient" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
