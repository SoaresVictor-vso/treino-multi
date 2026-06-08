"use client";

import { useState } from "react";
import { API_URL } from "@/lib/constants";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ErrorBox from "@/components/ui/ErrorBox";
import validateCPF from "@/utilities/validators/cpf";
import validateEmail from "@/utilities/validators/email";

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndCleanLogin = (value: string) => {
    value = value.trim();
    if (!value) return "Campo obrigatório";

    if (validateCPF(value))
      value = value.replace(/\D/g, "");
    else if (!validateEmail(value))
      return "Digite um e-mail ou CPF válido";

    return null;
  }

  const validateAndSetLogin = (value: string) => {
    setLogin(value);
    setError(validateAndCleanLogin(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.message ?? "Credenciais inválidas.");
        return;
      }

      console.log("Login bem-sucedido!"); // TODO: redirecionar para dashboard
      console.log(res.json())
      // TODO: armazenar tokens e redirecionar
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Entrar</h1>
          <p className="mt-1 text-sm text-gray-500">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail ou CPF"
            placeholder="seu@email.com"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onBlur={(e) => setError(validateAndCleanLogin(e.target.value))}
          />
          <Input
            label="Senha"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <ErrorBox message={error} />

          <Button buttonStyle="default" disabled={loading}>
            <span>{loading ? "Entrando…" : "Entrar"}</span>
          </Button>
        </form>
      </div>
    </main>
  );
}
