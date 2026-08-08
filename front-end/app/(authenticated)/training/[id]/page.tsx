import Link from 'next/link';

export default async function TrainingPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return (
		<section className="mx-auto flex min-h-[calc(100vh-12rem)] w-full max-w-3xl items-center justify-center">
			<div className="w-full rounded-lg border border-outline-variant bg-surface-container-low p-6 text-center sm:p-10">
				<p className="type-label-caps text-primary-fixed">Treino</p>
				<h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
					Seu treino será exibido aqui
				</h1>
				<p className="type-body-md mx-auto mt-3 max-w-lg text-on-surface-variant">
					Estamos preparando os detalhes e a execução deste treino.
				</p>
				<p className="type-label-caps mt-6 break-all text-on-surface-variant">
					Identificador: {id}
				</p>
				<Link
					href="/home"
					className="type-body-md mt-8 inline-flex min-h-11 items-center rounded-md bg-primary-container px-4 font-semibold text-on-primary-container transition-colors hover:bg-primary-fixed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-fixed"
				>
					Voltar para início
				</Link>
			</div>
		</section>
	);
}
