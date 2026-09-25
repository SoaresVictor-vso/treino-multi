import { forwardRef } from 'react';
import { RiCheckLine } from 'react-icons/ri';
import type { ExecutionSetType } from '@/gateway/services/workouts';

export const seriesTypeClassName: Record<ExecutionSetType, string> = {
	padrao: 'border-primary-fixed-dim/20 bg-primary-fixed-dim/10 text-primary-fixed-dim',
	aquecimento: 'border-outline-variant bg-surface-variant text-on-surface-variant',
	dropset: 'border-purple-500/50 bg-purple-500/15 text-purple-300',
	falha: 'border-error/50 bg-error-container/30 text-error',
	contingencia_offline: 'border-amber-500/50 bg-amber-500/15 text-amber-300',
};

type SeriesIndicatorProps = {
	number: number;
	completed: boolean;
	tooltip: string;
	onClick?: () => void;
	disabled?: boolean;
	ariaExpanded?: boolean;
	className?: string;
};

const SeriesIndicator = forwardRef<HTMLButtonElement, SeriesIndicatorProps>(
	(
		{
			number,
			completed,
			tooltip,
			onClick,
			disabled = false,
			ariaExpanded,
			className,
		},
		ref,
	) => {
		const indicatorClassName =
			className ??
			'border-outline-variant bg-surface-variant text-on-surface-variant';
		const content = completed ? <RiCheckLine aria-hidden="true" /> : number;

		if (!onClick)
			return (
				<span
					className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold ${indicatorClassName}`}
					title={tooltip}
					aria-label={tooltip}
				>
					{content}
				</span>
			);

		return (
			<button
				ref={ref}
				type="button"
				disabled={disabled}
				onPointerDown={(event) => event.stopPropagation()}
				onClick={onClick}
				aria-label={tooltip}
				aria-expanded={ariaExpanded}
				className="rounded-md disabled:cursor-default"
			>
				<span
					className={`inline-flex h-7 w-7 items-center justify-center rounded-md border text-[11px] font-semibold ${indicatorClassName}`}
					title={tooltip}
				>
					{content}
				</span>
			</button>
		);
	},
);

SeriesIndicator.displayName = 'SeriesIndicator';

export default SeriesIndicator;
