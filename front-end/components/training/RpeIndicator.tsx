import { type PointerEvent } from 'react';

type RpeIndicatorProps = {
	prescribed: number | null;
	performed: number | null;
	mode?: 'expected' | 'performed';
	onClick?: () => void;
	disabled?: boolean;
	compact?: boolean;
	showComparison?: boolean;
};

export default function RpeIndicator({
	prescribed,
	performed,
	mode = 'performed',
	onClick,
	disabled = false,
	compact = false,
	showComparison = true,
}: RpeIndicatorProps) {
	const prescribedValue =
		prescribed !== null && prescribed > 0 ? prescribed : null;
	const performedValue = performed !== null && performed > 0 ? performed : null;
	const value =
		mode === 'expected' ? prescribedValue : performedValue || prescribedValue;
	if (value === null) return null;
	const content = <>RPE {value}</>;
	const title =
		prescribedValue !== null &&
		(mode === 'expected' || showComparison || performedValue === null)
			? `Prescrito: ${prescribedValue}`
			: undefined;
	const className = `inline-flex shrink-0 items-center whitespace-nowrap rounded-md border border-outline-variant bg-surface-variant font-bold text-on-surface-variant hover:border-primary-fixed-dim hover:text-primary-fixed-dim disabled:cursor-default ${compact ? 'h-7 px-1 text-[9px] leading-none' : 'h-8 px-1.5 text-[10px]'}`;

	if (!onClick)
		return (
			<span className={className} title={title} aria-label={title ?? 'RPE'}>
				{content}
			</span>
		);

	const handlePointerDown = (event: PointerEvent<HTMLButtonElement>) => {
		event.stopPropagation();
	};

	return (
		<button
			type="button"
			disabled={disabled}
			onPointerDown={handlePointerDown}
			onClick={onClick}
			className={className}
			title={title}
		>
			{content}
		</button>
	);
}
