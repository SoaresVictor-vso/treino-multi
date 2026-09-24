'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RiEyeLine, RiEyeOffLine } from 'react-icons/ri';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Checkbox from '@/components/ui/Checkbox';
import ErrorBox from '@/components/ui/ErrorBox';
import validateCPF from '@/utilities/validators/cpf';
import validateEmail from '@/utilities/validators/email';
import {
	clearSessionTokens,
	hasStoredRefreshToken,
	refreshAccessToken,
	storeSessionTokens,
	tokenHasEnoughLifetime,
} from '@/gateway/client';
import { LoginService } from '@/gateway/services/login';
import { getAuthToken } from '@/lib/auth';
import { getLandingPathForRoles } from '@/lib/landing';
import { getSessionUser } from '@/lib/auth';
import { apiRequest } from '@/gateway/client';
import { ATHLETE_SELF_REGISTRATION_ENABLED } from '@shared/constants';
import Link from 'next/link';
import GoogleCredentialButton from '@/components/auth/GoogleCredentialButton';

const REMEMBER_ME_KEY = 'rememberMe';

export default function Login() {
	const router = useRouter();
	const [login, setLogin] = useState('');
	const [password, setPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [rememberMe, setRememberMe] = useState(
		() =>
			typeof window !== 'undefined' &&
			localStorage.getItem(REMEMBER_ME_KEY) === 'true',
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		if (!hasStoredRefreshToken()) return;

		let isActive = true;

		async function restoreRememberedSession() {
			if (tokenHasEnoughLifetime(getAuthToken())) {
				router.replace(getLandingPathForRoles(getSessionUser()?.roles ?? []));
				return;
			}

			const response = await refreshAccessToken();
			if (isActive && response.success && response.data?.accessToken) {
				router.replace(getLandingPathForRoles(getSessionUser()?.roles ?? []));
			} else if (isActive) {
				// Um refresh que falhou não deve ser tentado indefinidamente nem
				// manter credenciais de sessão inválidas no navegador.
				clearSessionTokens();
			}
		}

		void restoreRememberedSession();

		return () => {
			isActive = false;
		};
	}, [rememberMe, router]);

	const validateAndCleanLogin = (value: string) => {
		value = value.trim();
		if (!value) return 'Campo obrigatório';

		if (validateCPF(value)) value = value.replace(/\D/g, '');
		else if (!validateEmail(value)) return 'Digite um e-mail ou CPF válido';

		return null;
	};

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setLoading(true);

		try {
			if (!rememberMe) {
				await apiRequest('auth/forget-browser', { method: 'POST' }, false);
				clearSessionTokens();
			}
			const loginService = new LoginService();
			const normalizedLogin = login.trim();
			const res = await loginService.login(
				normalizedLogin.includes('@')
					? normalizedLogin.toLocaleLowerCase('en-US')
					: normalizedLogin,
				password,
				rememberMe,
			);
			if (!res.success) {
				setLoading(false);
				setError(res.error || 'Não foi possível realizar o login.');
				return;
			}

			const { accessToken: newAccessToken, refreshToken: newRefreshToken } =
				res.data!;
			storeSessionTokens(newAccessToken, newRefreshToken, rememberMe);

			setLoading(false);
			router.replace(getLandingPathForRoles(getSessionUser()?.roles ?? []));
		} catch {
			setLoading(false);
			setError('Não foi possível realizar o login.');
		}
	}

	async function handleGoogleCredential(credential: string) {
		setLoading(true); setError(null);
		if (!rememberMe) {
			await apiRequest('auth/forget-browser', { method: 'POST' }, false);
			clearSessionTokens();
		}
		const result = await apiRequest<{ accessToken: string; refreshToken: string }>('auth/oauth/login', {
			method: 'POST', body: JSON.stringify({ provider: 'google', credential, rememberMe }),
		}, false);
		setLoading(false);
		if (!result.success || !result.data) { setError(result.error || 'Login Google indisponível.'); return; }
		storeSessionTokens(result.data.accessToken, result.data.refreshToken, rememberMe);
		router.replace(getLandingPathForRoles(getSessionUser()?.roles ?? []));
	}

	return (
		<main className="min-h-screen flex items-center justify-center px-4">
			<div className="w-full max-w-sm rounded-2xl bg-surface-container shadow-md p-8 space-y-6">
				<div className="text-center">
					<h1 className="text-2xl font-bold text-headline text-primary-container">
						Entrar
					</h1>
					<p className="mt-1 text-sm text-body text-on-surface-variant ">
						Acesse sua conta
					</p>
				</div>

				<form onSubmit={handleSubmit} className="space-y-4">
					<Input
						label="E-mail ou CPF"
						// placeholder="seu@email.com"
						value={login}
						onChange={(e) => setLogin(e.target.value)}
						onBlur={(e) => setError(validateAndCleanLogin(e.target.value))}
						selectOnClick={false}
					/>
					<Input
						label="Senha"
						type={showPassword ? 'text' : 'password'}
						// placeholder="••••••••"
						value={password}
						onChange={(e) => setPassword(e.target.value)}
						selectOnClick={false}
						trailingContent={
							<button
								type="button"
								onClick={() => setShowPassword((visible) => !visible)}
								className="rounded p-1 text-on-surface-variant transition-colors hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim/30"
								aria-label={showPassword ? 'Ocultar senha' : 'Visualizar senha'}
								aria-pressed={showPassword}
							>
								{showPassword ? <RiEyeOffLine size={20} /> : <RiEyeLine size={20} />}
							</button>
						}
					/>
					<Checkbox
						id="remember-me"
						label="Lembrar de mim"
						checked={rememberMe}
						onChange={(event) => setRememberMe(event.target.checked)}
					/>

					<ErrorBox message={error} />

					<Button disabled={loading} className="w-full" type="submit">
						<span>{loading ? 'Entrando…' : 'Entrar'}</span>
					</Button>
			</form>
			<div className="flex justify-center"><GoogleCredentialButton onCredential={handleGoogleCredential} /></div>
			{ATHLETE_SELF_REGISTRATION_ENABLED && <p className="text-center text-sm"><Link href="/cadastro" className="text-primary-fixed underline">Criar conta de atleta</Link></p>}
			</div>
		</main>
	);
}
