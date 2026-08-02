'use client';
import Input from '@/components/ui/Input';
import type {
	Exercise,
	Metric,
} from '@/app/(authenticated)/workout-template/types';
import type { RegisterType } from './types';
import { metricUnits } from '@/app/(authenticated)/workout-template/mocks';
export function MetricField({
	className,
	label,
	unit,
	value,
	type,
	onChange,
	onTypeChange,
	optional = false,
	exercise,
	disabled = false,
}: {
	label?: string;
	unit?: string;
	value: string;
	type?: RegisterType;
	onChange: (value: string) => void;
	onTypeChange?: (value: RegisterType) => void;
	optional?: boolean;
	className?: string;
	exercise: Exercise;
	disabled?: boolean;
}) {
	if (!label) return null;

	const metric_2 =
		(exercise?.metric_2 && metricUnits[exercise?.metric_2]) || null;
	const hasButtonMetric2 = !!onTypeChange && metric_2;

	return (
		<div className="block text-[11px] font-semibold leading-none text-on-surface-variant">
			{label}
			{unit ? ` (${unit})` : ''}
			{optional ? ' (opcional)' : ''}
			<div className="mt-1 flex h-8">
				<Input
					aria-label={`${label}${unit ? ` (${unit})` : ''}`}
					sizeVariant="sm"
					type="number"
					min={label === 'PSE' ? 1 : undefined}
					max={label === 'PSE' ? 10 : undefined}
					value={value}
					onChange={(event) => onChange(event.target.value)}
					disabled={disabled}
					sideComponent={hasButtonMetric2 ? 'right' : 'none'}
				/>
				{hasButtonMetric2 && (
					<button
						type="button"
						disabled={disabled}
						onClick={() => onTypeChange(type === 'p' ? 'v' : 'p')}
						className="h-[30px] w-auto px-1 rounded-r-lg border border-l-0 border-outline-variant bg-surface-container-highest text-xs font-bold text-primary-fixed-dim"
						aria-label={`Alternar unidade entre porcentagem e valor, atual ${type}`}
					>
						{type === 'p' ? '%' : metric_2}
					</button>
				)}
			</div>
		</div>
	);
}
