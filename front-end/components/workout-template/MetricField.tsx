'use client';
import Input from '@/components/ui/Input';
import { Metric, MetricFieldType } from '@/gateway/services/parametro';
import type { RegisterType } from '@/gateway/services/workout-templates';
import { secondsToTime, timeToSeconds } from '@/lib/tools';

export function MetricField({
	metric,
	value,
	type,
	allowPercent,
	limits: { min, max } = {},
	onChange,
	onTypeChange,
	optional = false,
	disabled = false,
}: {
	value: string | number | undefined;
	metric: Metric;
	type?: RegisterType;
	onChange: (value: string | number) => void;
	onTypeChange: (value: 'v' | 'p') => void;
	optional?: boolean;
	disabled?: boolean;
	limits?: {
		min?: number;
		max?: number;
	};
	allowPercent?: boolean;
}) {
	const isPercent = type === 'p';

	const getType = (fieldType: MetricFieldType) => {
		if (isPercent) return 'number';

		switch (fieldType) {
			case MetricFieldType.INT:
			case MetricFieldType.DECIMAL:
				return 'number';
			case MetricFieldType.TIME:
				return 'time';
		}
	};

	const label = metric.name ?? '';
	const unit = type === 'p' ? '%' : metric.symbol;

	const handleValue = (value?: string | number) => {
		value = value ?? '';
		if (metric.fieldType === MetricFieldType.TIME && !isPercent) {
			return secondsToTime(value as number);
		}
		return value;
	};

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		let inputValue: string | number = event.target.value;

		if (
			metric.fieldType === MetricFieldType.INT ||
			metric.fieldType === MetricFieldType.DECIMAL
		) {
			inputValue = inputValue === '' ? '' : Number(inputValue);
		}

		if (metric.fieldType === MetricFieldType.TIME && !isPercent) {
			inputValue = timeToSeconds(String(inputValue) || '0');
		}

		if (isPercent) {
			inputValue = inputValue === '' ? '' : Number(inputValue);
		}
		onChange(inputValue);
	};

	return (
		<div className="block text-xs font-semibold leading-none text-on-surface-variant">
			{label}
			{unit ? ` (${unit})` : ''}
			{optional ? ' (opcional)' : ''}
			<div className="mt-1 flex h-8">
				<Input
					aria-label={`${label}${unit ? ` (${unit})` : ''}`}
					sizeVariant="sm"
					type={getType(metric?.fieldType)}
					step={
						isPercent
							? 'any'
							: metric.fieldType === MetricFieldType.TIME
								? 1
								: undefined
					}
					min={min}
					max={max}
					value={handleValue(value)}
					onChange={handleChange}
					disabled={disabled}
					sideComponent={allowPercent ? 'right' : 'none'}
				/>
				{allowPercent && (
					<button
						type="button"
						disabled={disabled}
						onClick={() => onTypeChange(type === 'p' ? 'v' : 'p')}
						className="h-full w-auto rounded-r-lg border border-l-0 border-outline-variant bg-surface-container-highest px-1 text-xs font-bold text-primary-fixed-dim"
						aria-label={`Alternar unidade entre porcentagem e valor, atual ${metric.symbol}`}
					>
						{type === 'p' ? '%' : metric.symbol}
					</button>
				)}
			</div>
		</div>
	);
}
