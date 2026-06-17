"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ErrorBox from "@/components/ui/ErrorBox";
import validateCPF from "@/utilities/validators/cpf";
import validateEmail from "@/utilities/validators/email";
import { LoginService } from "@/api/services/login";
import { setAuthCookie } from "@/lib/auth";
import usePersistedState from "@/hooks/usePersistedState";

export default function Login() {
  
  const [accessToken, setAccessToken] = usePersistedState<string | null>('accessToken', null);
  const [__, setRefreshToken] = usePersistedState<string | null>('refreshToken', null);
  const router = useRouter();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);


    try {
      const loginService = new LoginService();
      const res = await loginService.login(login, password);
      if (!res.success) {
        setLoading(false);
        setError(res.error || "Não foi possível realizar o login.");
        return;
      }

      setAccessToken(res.data!.accessToken);
      setRefreshToken(res.data!.refreshToken);

      console.log("Login bem-sucedido!");
      console.log(res.success);
      if (accessToken)
        setAuthCookie(accessToken);
      router.push("/home");
    } catch (error) {
      setLoading(false);
      setError("Não foi possívelrealizar o login.");
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-surface-container shadow-md p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-headline text-primary-container">Entrar</h1>
          <p className="mt-1 text-sm text-body text-on-surface-variant ">Acesse sua conta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="E-mail ou CPF"
            // placeholder="seu@email.com"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onBlur={(e) => setError(validateAndCleanLogin(e.target.value))}
          />
          <Input
            label="Senha"
            type="password"
            // placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <ErrorBox message={error} />

          <Button disabled={loading} className="w-full">
            <span>{loading ? "Entrando…" : "Entrar"}</span>
          </Button>
        </form>
      </div>
    </main>
  );
}
