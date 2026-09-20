import type { ExecutionSetType } from '@/gateway/services/workouts';
import { seriesTypeClassName } from './SeriesIndicator';

export const setOptions: { value: ExecutionSetType; label: string }[] = [
	{ value: 'padrao', label: 'Padrão' },
	{ value: 'aquecimento', label: 'Aquecimento' },
	{ value: 'dropset', label: 'Dropset' },
	{ value: 'falha', label: 'Falha' },
];

export default function SetTypePicker({
	value,
	number,
	onChange,
}: {
	value: ExecutionSetType;
	number: number;
	onChange: (value: ExecutionSetType) => void;
}) {
	return (
		<>
			<p className="px-2 pb-1 text-xs font-semibold text-on-surface-variant">
				Tipo da série
			</p>
			{setOptions.map((option) => (
				<button
					key={option.value}
					type="button"
					onClick={() => onChange(option.value)}
					className={`mb-1 flex w-full items-center rounded px-2 py-1.5 text-left text-sm hover:bg-surface-variant ${value === option.value ? 'font-bold' : ''}`}
				>
					<span
						className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded border text-[10px] font-bold ${seriesTypeClassName[option.value]}`}
					>
						{number}
					</span>
					{option.label}
				</button>
			))}
		</>
	);
}
