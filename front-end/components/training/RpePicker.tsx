export default function RpePicker({
	value,
	onChange,
}: {
	value: number | null | undefined;
	onChange: (value: number | null) => void;
}) {
	const buttonClassName = (rpe: number) =>
		`rounded py-2 text-sm font-bold hover:bg-primary-container hover:text-on-primary-container ${value === rpe ? 'bg-primary-container text-on-primary-container' : 'bg-surface-variant'}`;

	return (
		<>
			<div className="grid grid-cols-6 gap-1">
				{[1, 2, 3, 4, 5, 6].map((rpe) => (
					<button key={rpe} type="button" onClick={() => onChange(rpe)} className={buttonClassName(rpe)}>
						{rpe}
					</button>
				))}
			</div>
			<div className="mt-1 grid grid-cols-6 gap-1">
				{[7, 8, 9, 9.5, 10].map((rpe) => (
					<button key={rpe} type="button" onClick={() => onChange(rpe)} className={buttonClassName(rpe)}>
						{rpe}
					</button>
				))}
				<button
					type="button"
					onClick={() => onChange(null)}
					aria-label="Remover RPE"
					className="rounded bg-error py-2 text-sm font-bold text-on-error hover:bg-error/80"
				>
					×
				</button>
			</div>
		</>
	);
}
