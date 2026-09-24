'use client';
import { useCallback, useEffect, useRef } from 'react';
import Script from 'next/script';

type GoogleWindow = Window & {
	google?: {
		accounts: {
			id: {
				initialize: (options: {
					client_id: string;
					callback: (response: { credential: string }) => void;
				}) => void;
				renderButton: (
					target: HTMLElement,
					options: Record<string, unknown>,
				) => void;
			};
		};
	};
};

export default function GoogleCredentialButton({
	onCredential,
}: {
	onCredential: (credential: string) => void;
}) {
	const target = useRef<HTMLDivElement>(null);
	const callback = useRef(onCredential);
	useEffect(() => {
		callback.current = onCredential;
	}, [onCredential]);
	const renderButton = useCallback(() => {
		const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
		const google = (window as GoogleWindow).google;
		if (!google || !target.current || !clientId) return;
		google.accounts.id.initialize({
			client_id: clientId,
			callback: (result) => callback.current(result.credential),
		});
		target.current.replaceChildren();
		google.accounts.id.renderButton(target.current, {
			theme: 'outline',
			size: 'large',
			text: 'continue_with',
		});
	}, []);
	// Em navegação client-side, o SDK pode estar carregado antes desta instância montar.
	useEffect(() => { renderButton(); }, [renderButton]);

	if (!process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)
		return (
			<p className="text-sm text-on-surface-variant">
				Login Google indisponível nesta implantação.
			</p>
		);
	return (
		<>
			<Script
				src="https://accounts.google.com/gsi/client"
				strategy="afterInteractive"
				onReady={renderButton}
			/>
			<div ref={target} aria-label="Entrar com Google" />
		</>
	);
}
