'use client';
import Input from '@/components/ui/Input';
import { Metric, MetricFieldType } from '@/gateway/services/parametro';
import type { RegisterType } from '@/gateway/services/workout-templates';

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
	inputClassName,
	compact = false,
}: {
	value: string | number | undefined;
	metric: Metric;
	type?: RegisterType;
	onChange: (value: string | number) => void;
	onTypeChange: (value: 'v' | 'p') => void;
	optional?: boolean;
	disabled?: boolean;
	inputClassName?: string;
	compact?: boolean;
	limits?: {
		min?: number;
		max?: number;
	};
	allowPercent?: boolean;
}) {
	const isPercent = type === 'p';
	const isTime = metric.fieldType === MetricFieldType.TIME && !isPercent;

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

		if (isPercent) {
			inputValue = inputValue === '' ? '' : Number(inputValue);
		}
		onChange(inputValue);
	};

	return (
		<div
			className={`block min-w-0 font-semibold leading-none text-on-surface-variant ${isTime ? '' : ''} ${compact ? 'text-[10px]' : 'text-xs'}`}
		>
			<span className="block truncate">
				{label}
				{unit ? ` (${unit})` : ''}
				{optional ? ' (opcional)' : ''}
			</span>
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
					value={isTime ? Number(value ?? 0) : handleValue(value)}
					onChange={isTime ? undefined : handleChange}
					onTimeChange={isTime ? onChange : undefined}
					disabled={disabled}
					className={inputClassName}
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
