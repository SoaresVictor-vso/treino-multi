'use client';

import { useEffect, useMemo } from 'react';
import { RiCheckLine, RiCloseLine, RiTrophyFill } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import type { WorkoutMeasurement } from '@/gateway/services/workouts';
import WorkoutMeasurements from './WorkoutMeasurements';
import styles from './WorkoutCompletionScreen.module.css';

export const completionMessages = [
	'Veni Vidi Vici.',
	'Treino entregue.',
	'Missão cumprida!.',
	'O de hoje ta pago!',
	'Mais um pra conta.',
];

type WorkoutCompletionScreenProps = {
	measurements: WorkoutMeasurement[];
	message: string;
	onConfirm: () => void;
};

export default function WorkoutCompletionScreen({
	measurements,
	message,
	onConfirm,
}: WorkoutCompletionScreenProps) {
	useEffect(() => {
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		return () => {
			document.body.style.overflow = previousOverflow;
		};
	}, []);

	const topMeasurements = useMemo(
		() =>
			[...measurements]
				.sort((left, right) => right.score - left.score)
				.slice(0, 3),
		[measurements],
	);

	return (
		<section
			className={`${styles.screen} fixed inset-0 z-30 flex items-center justify-center overflow-hidden bg-black/72 p-4 backdrop-blur-sm sm:p-6`}
			aria-labelledby="workout-completion-title"
		>
			<div
				className={`${styles.card} relative my-auto w-full max-w-2xl overflow-hidden rounded-[2rem] border border-primary-container/30 bg-surface-container p-5 text-center shadow-[0_28px_90px_rgba(0,0,0,0.3)] sm:p-7 lg:max-w-5xl lg:p-8`}
			>
				<button
					type="button"
					onClick={onConfirm}
					className="absolute right-4 top-4 z-10 grid h-10 w-10 place-items-center rounded-full border border-outline-variant bg-surface-container-high text-on-surface-variant transition hover:bg-surface-variant hover:text-primary focus:outline-none focus:ring-2 focus:ring-primary-fixed sm:right-6 sm:top-6"
					aria-label="Fechar e ver revisão do treino"
				>
					<RiCloseLine size={22} aria-hidden="true" />
				</button>
				<span className={`${styles.spark} ${styles.sparkOne}`} aria-hidden="true" />
				<span className={`${styles.spark} ${styles.sparkTwo}`} aria-hidden="true" />
				<span
					className={`${styles.spark} ${styles.sparkThree}`}
					aria-hidden="true"
				/>
				<div
					className={`${styles.trophy} mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary-container text-3xl text-on-primary-fixed shadow-[0_0_35px_rgba(195,244,0,0.35)] sm:h-20 sm:w-20 sm:text-4xl`}
				>
					<RiTrophyFill aria-hidden="true" />
				</div>
				<p className="mt-4 type-label-caps text-primary-fixed sm:mt-6">
					Treino finalizado
				</p>
				<h1
					id="workout-completion-title"
					className="mt-1 text-xl font-bold tracking-tight text-primary sm:mt-2 sm:text-3xl"
				>
					Parabéns!
				</h1>
				<p className="mx-auto mt-2 max-w-xl text-[13px] leading-5 text-on-surface-variant sm:mt-3 sm:text-sm sm:leading-6">
					{message}
				</p>

				{topMeasurements.length > 0 && (
					<div className="mt-5 text-left sm:mt-7">
						<div className="lg:hidden">
							<WorkoutMeasurements measurements={topMeasurements} compact />
						</div>
						<div className="hidden lg:block">
							<WorkoutMeasurements measurements={topMeasurements} />
						</div>
					</div>
				)}

				<Button className="mt-5 min-w-52 sm:mt-7 sm:min-w-56" onClick={onConfirm}>
					<RiCheckLine /> Ver revisão do treino
				</Button>
			</div>
		</section>
	);
}
