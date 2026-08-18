'use client';
import Input from '@/components/ui/Input';
import {
	secondsToTime,
	timeToSeconds,
} from '@/gateway/services/workout-templates';
export function RestDurationField({
	value,
	onChange,
	disabled = false,
}: {
	value: number;
	onChange: (seconds: number) => void;
	disabled?: boolean;
}) {
	return (
		<div className="block text-xs font-semibold leading-none text-on-surface-variant">
			Descanso
			<div className="mt-1 flex h-8">
				<Input
					aria-label="Duração do descanso"
					sizeVariant="sm"
					type="time"
					step={1}
					value={secondsToTime(value)}
					onChange={(event) => onChange(timeToSeconds(event.target.value))}
					disabled={disabled}
				/>
			</div>
		</div>
	);
}
