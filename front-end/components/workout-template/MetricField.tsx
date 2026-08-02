'use client';
import Input from '@/components/ui/Input';
import {
	Metric,
	MetricFieldType,
} from '@/app/(authenticated)/workout-template/types';
import type { RegisterType } from '../../app/(authenticated)/workout-template/types';
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
	const getType = (type: MetricFieldType) => {
		switch (type) {
			case MetricFieldType.INT:
			case MetricFieldType.DECIMAL:
				return 'number';
			case MetricFieldType.TIME:
				return 'time';
		}
	};

	const label = metric.name ?? '';
	const unit = metric.symbol;

	const handleValue = (value?: string | number) => {
		value = value ?? '';
		if (metric.fieldType === MetricFieldType.TIME) {
			return secondsToTime(value as number);
		}
		return value;
	};

	const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
		let inputValue: string | number = event.target.value;

		if (metric.fieldType === MetricFieldType.TIME) {
			inputValue = timeToSeconds(inputValue);
		}
		onChange(inputValue);
	};

	return (
		<div className="block text-[11px] font-semibold leading-none text-on-surface-variant">
			{label}
			{unit ? ` (${unit})` : ''}
			{optional ? ' (opcional)' : ''}
			<div className="mt-1 flex h-8">
				<Input
					aria-label={`${label}${unit ? ` (${unit})` : ''}`}
					sizeVariant="sm"
					type={getType(metric?.fieldType)}
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
						className="h-[30px] w-auto px-1 rounded-r-lg border border-l-0 border-outline-variant bg-surface-container-highest text-xs font-bold text-primary-fixed-dim"
						aria-label={`Alternar unidade entre porcentagem e valor, atual ${metric.symbol}`}
					>
						{type === 'p' ? '%' : metric.symbol}
					</button>
				)}
			</div>
		</div>
	);
}
