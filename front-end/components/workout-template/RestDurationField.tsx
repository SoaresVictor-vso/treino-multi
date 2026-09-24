'use client';
import Input from '@/components/ui/Input';
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
					value={value}
					onTimeChange={onChange}
					disabled={disabled}
				/>
			</div>
		</div>
	);
}
