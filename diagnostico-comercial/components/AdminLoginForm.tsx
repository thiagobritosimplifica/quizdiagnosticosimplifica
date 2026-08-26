"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import BrandMark from "./BrandMark";

export default function AdminLoginForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-12">
      <div className="flex justify-center">
        <BrandMark />
      </div>

      <section className="card animate-fade-up mt-8 p-7 sm:p-9">
        <h1 className="text-xl font-bold tracking-tight">Área da equipe</h1>
        <p className="mt-2 text-sm text-mist-400">
          Acesso restrito ao painel de diagnósticos.
        </p>

        <form onSubmit={submit} className="mt-7 grid gap-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-[13px] font-medium text-mist-300"
            >
              Senha de acesso
            </label>
            <input
              id="password"
              type="password"
              className="field"
              value={password}
              autoComplete="current-password"
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="animate-fade-in rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || password.length === 0}
            className="btn-primary mt-1 w-full text-[15px] uppercase"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </section>

      <a
        href="/"
        className="mt-6 text-center text-xs text-mist-500 transition-colors hover:text-mist-300"
      >
        Voltar para a página do diagnóstico
      </a>
    </main>
  );
}
