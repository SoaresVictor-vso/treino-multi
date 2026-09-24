'use client';

import {
	ChangeEvent,
	ForwardedRef,
	forwardRef,
	InputHTMLAttributes,
	KeyboardEvent as ReactKeyboardEvent,
	MouseEvent,
	ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from 'react';
import { RiTimeLine } from 'react-icons/ri';

type TimeInputProps = InputHTMLAttributes<HTMLInputElement> & {
	sizeVariant?: 'sm' | 'md';
	label?: string;
	error?: string;
	hint?: string;
	leadingIcon?: ReactNode;
	trailingContent?: ReactNode;
	selectOnClick?: boolean;
	sideComponent?: 'right' | 'left' | 'both' | 'none';
	onTimeChange?: (seconds: number) => void;
};

const MAX_TIME_SECONDS = 999 * 3600 + 59 * 60 + 59;

function parseSeconds(value: string | number | readonly string[] | undefined): number {
	if (typeof value !== 'string' && typeof value !== 'number') value = value?.[0];
	if (typeof value === 'number') return Number.isFinite(value) ? Math.min(MAX_TIME_SECONDS, Math.max(0, Math.floor(value))) : 0;
	if (!value) return 0;
	if (/^\d+:\d{2}:\d{2}$/.test(value)) {
		const [hours, rawMinutes, rawSeconds] = value.split(':').map(Number);
		const minutes = Math.min(59, rawMinutes);
		const seconds = Math.min(59, rawSeconds);
		return Math.min(MAX_TIME_SECONDS, hours * 3600 + minutes * 60 + seconds);
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.min(MAX_TIME_SECONDS, Math.max(0, Math.floor(parsed))) : 0;
}

function formatTime(seconds: number): string {
	const safeSeconds = Math.min(MAX_TIME_SECONDS, Math.max(0, Math.floor(seconds)));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	const remainder = safeSeconds % 60;
	return `${String(hours).padStart(3, '0')}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function segmentRange(part: 'hours' | 'minutes' | 'seconds') {
	if (part === 'hours') return { start: 0, width: 3 };
	if (part === 'minutes') return { start: 4, width: 2 };
	return { start: 7, width: 2 };
}

function segmentAt(caret: number): 'hours' | 'minutes' | 'seconds' {
	if (caret <= 3) return 'hours';
	if (caret <= 6) return 'minutes';
	return 'seconds';
}

const WHEEL_ROW_HEIGHT = 32;

function CyclicTimeWheel({
	label,
	count,
	value,
	onChange,
}: {
	label: string;
	count: number;
	value: number;
	onChange: (value: number) => void;
}) {
	const scrollRef = useRef<HTMLDivElement>(null);
	const initialized = useRef(false);
	const lastValue = useRef(value);

	useEffect(() => {
		lastValue.current = value;
	}, [value]);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element || initialized.current) return;
		element.scrollTop = (count + value - 1) * WHEEL_ROW_HEIGHT;
		initialized.current = true;
	}, [count, value]);

	const normalizeScroll = () => {
		const element = scrollRef.current;
		if (!element) return;
		const centerIndex = Math.round(element.scrollTop / WHEEL_ROW_HEIGHT) + 1;
		const wrappedValue = ((centerIndex % count) + count) % count;

		if (centerIndex < count || centerIndex >= count * 2) {
			const middleIndex = count + wrappedValue;
			element.scrollTop = (middleIndex - 1) * WHEEL_ROW_HEIGHT;
		}
		if (wrappedValue !== lastValue.current) {
			lastValue.current = wrappedValue;
			onChange(wrappedValue);
		}
	};

	return (
		<div className="flex w-16 flex-col items-center gap-1 text-xs text-on-surface-variant">
			<span>{label}</span>
			<div
				ref={scrollRef}
				role="listbox"
				aria-label={label}
				tabIndex={0}
				onScroll={normalizeScroll}
				className="h-24 w-full snap-y snap-mandatory overflow-y-auto overscroll-contain rounded-md border border-outline-variant bg-surface-container text-primary [scrollbar-width:none]"
			>
				{Array.from({ length: count * 3 }, (_, index) => {
					const option = index % count;
					return (
						<button
							key={index}
							type="button"
							role="option"
							aria-selected={option === value}
							onClick={() => {
								const element = scrollRef.current;
								if (element) element.scrollTop = (index - 1) * WHEEL_ROW_HEIGHT;
								onChange(option);
							}}
							className={`block h-8 w-full snap-center text-center leading-8 ${option === value ? 'font-semibold text-primary' : 'text-on-surface-variant/60'}`}
						>
							{String(option).padStart(2, '0')}
						</button>
					);
				})}
			</div>
		</div>
	);
}

function partsFromTime(value: string) {
	const [hours, minutes, seconds] = value.split(':').map(Number);
	return { hours, minutes, seconds };
}

function TimeInput(
	{
		label,
		error,
		hint,
		id,
		sizeVariant = 'md',
		className = '',
		placeholder,
		onChange,
		onClick,
		onKeyDown,
		onTimeChange,
		value,
		defaultValue,
		disabled,
		readOnly,
		leadingIcon,
		trailingContent,
		selectOnClick = true,
		sideComponent = 'none',
		...props
	}: TimeInputProps,
	ref: ForwardedRef<HTMLInputElement>,
) {
	const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
	const isControlled = value !== undefined;
	const [internalSeconds, setInternalSeconds] = useState(() => parseSeconds(defaultValue));
	const [pickerOpen, setPickerOpen] = useState(false);
	const activeSegment = useRef<'hours' | 'minutes' | 'seconds'>('hours');
	const segmentBuffer = useRef('');
	const pendingSelection = useRef<{ start: number; end: number } | null>(null);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const seconds = isControlled ? parseSeconds(value) : internalSeconds;
	const displayValue = formatTime(seconds);
	const { hours, minutes, seconds: remainder } = partsFromTime(displayValue);
	const hasValue = isControlled ? value !== '' && value !== undefined : internalSeconds > 0 || defaultValue !== undefined;

	useLayoutEffect(() => {
		if (!pendingSelection.current || !inputRef.current) return;
		inputRef.current.setSelectionRange(pendingSelection.current.start, pendingSelection.current.end);
		pendingSelection.current = null;
	});

	useEffect(() => {
		if (isControlled) return;
		if (defaultValue !== undefined) setInternalSeconds(parseSeconds(defaultValue));
	}, [defaultValue, isControlled]);

	if (props.required && label) label = `${label} *`;

	const emitChange = (nextSeconds: number, nextDisplayValue: string, input: HTMLInputElement) => {
		if (!isControlled) setInternalSeconds(nextSeconds);
		onTimeChange?.(nextSeconds);
		if (onChange) {
			const target = Object.create(input) as HTMLInputElement;
			Object.defineProperty(target, 'value', { value: nextDisplayValue });
			const event = {
				target,
				currentTarget: input,
			} as ChangeEvent<HTMLInputElement>;
			onChange(event);
		}
	};

	const handleTextChange = (event: ChangeEvent<HTMLInputElement>) => {
		const part = activeSegment.current;
		const pieces = event.currentTarget.value.split(':');
		const pieceIndex = part === 'hours' ? 0 : part === 'minutes' ? 1 : 2;
		const width = part === 'hours' ? 3 : 2;
		const rawDigits = (pieces[pieceIndex] ?? '').replace(/\D/g, '');
		const digits = rawDigits.slice(-width);
		segmentBuffer.current = digits;
		const parsed = Number(digits || 0);
		updatePart(part, part === 'hours' ? Math.min(999, parsed) : Math.min(59, parsed), true);
	};

	const updatePart = (
		part: 'hours' | 'minutes' | 'seconds',
		nextValue: number,
		keepBuffer = false,
	) => {
		if (!keepBuffer) segmentBuffer.current = '';
		const next = {
			hours: part === 'hours' ? nextValue : hours,
			minutes: part === 'minutes' ? nextValue : minutes,
			seconds: part === 'seconds' ? nextValue : remainder,
		};
		const nextSeconds = next.hours * 3600 + next.minutes * 60 + next.seconds;
		const nextDisplayValue = formatTime(nextSeconds);
		const input = inputRef.current;
		if (input) {
			input.value = nextDisplayValue;
			const { start, width } = segmentRange(part);
			const caret = start + width - 1;
			input.setSelectionRange(caret, caret);
			if (nextDisplayValue !== displayValue) pendingSelection.current = { start: caret, end: caret };
			emitChange(nextSeconds, nextDisplayValue, input);
		}
	};
	const assignRef = (node: HTMLInputElement | null) => {
		inputRef.current = node;
		if (typeof ref === 'function') ref(node);
		else if (ref) ref.current = node;
	};

	const roundedClass =
		sideComponent === 'both'
			? 'rounded-none '
			: sideComponent === 'right'
				? `rounded-r-none ${sizeVariant === 'sm' ? 'rounded-l-md ' : 'rounded-l-xl '}`
				: sideComponent === 'left'
					? `rounded-l-none ${sizeVariant === 'sm' ? 'rounded-r-md ' : 'rounded-r-xl '}`
					: sizeVariant === 'sm' ? 'rounded-md ' : 'rounded-xl ';
	const sizeClass = sizeVariant === 'sm' ? 'py-1 text-sm' : 'py-3 text-base';
	const handleClick = (event: MouseEvent<HTMLInputElement>) => {
		onClick?.(event);
		const caret = event.currentTarget.selectionStart ?? 0;
		const part = segmentAt(caret);
		activeSegment.current = part;
		segmentBuffer.current = '';
		if (selectOnClick) {
			const { start, width } = segmentRange(part);
			event.currentTarget.setSelectionRange(start, start + width);
		}
	};

	const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
		onKeyDown?.(event);
		if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
		const part = activeSegment.current;
		const width = part === 'hours' ? 3 : 2;
		if (/^\d$/.test(event.key)) {
			event.preventDefault();
			const nextBuffer = segmentBuffer.current.length >= width
				? event.key
				: segmentBuffer.current + event.key;
			segmentBuffer.current = nextBuffer;
			const parsed = Number(nextBuffer);
			updatePart(part, part === 'hours' ? Math.min(999, parsed) : Math.min(59, parsed), true);
			return;
		}

		if (event.key === 'Backspace' || event.key === 'Delete') {
			event.preventDefault();
			const nextBuffer = event.key === 'Backspace' ? segmentBuffer.current.slice(0, -1) : '';
			segmentBuffer.current = nextBuffer;
			updatePart(part, nextBuffer ? Number(nextBuffer) : 0, true);
			return;
		}

		if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
			event.preventDefault();
			const parts = ['hours', 'minutes', 'seconds'] as const;
			const nextIndex = Math.max(0, Math.min(2, parts.indexOf(part) + (event.key === 'ArrowRight' ? 1 : -1)));
			const nextPart = parts[nextIndex];
			activeSegment.current = nextPart;
			segmentBuffer.current = '';
			const { start, width: nextWidth } = segmentRange(nextPart);
			event.currentTarget.setSelectionRange(start, start + nextWidth);
			return;
		}

		if (event.key.length === 1 && !/^\d$/.test(event.key)) event.preventDefault();
	};

	return (
		<div className="flex w-full min-w-0 flex-col gap-1">
			{label && (
				<label htmlFor={inputId} className={`min-h-4 text-xs leading-none transition-opacity ${hasValue ? 'opacity-100 text-primary' : 'opacity-0'}`}>
					{label}
				</label>
			)}
			<div className={`relative flex min-w-0 items-center border border-outline-variant bg-surface-container-high transition-colors ${roundedClass}${error ? 'border-error/60 ' : 'focus-within:border-primary-fixed-dim/50 '}`}>
				{leadingIcon ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">{leadingIcon}</span> : null}
				<input
					{...props}
					ref={assignRef}
					id={inputId}
					type="text"
					inputMode="numeric"
					aria-invalid={!!error}
					aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
					aria-label={props['aria-label'] ?? label}
					placeholder={placeholder ?? 'hhh:mm:ss'}
					value={displayValue}
					disabled={disabled}
					readOnly={readOnly}
				onChange={handleTextChange}
				onClick={handleClick}
				onKeyDown={handleKeyDown}
					className={`min-w-0 w-0 flex-1 rounded-xl bg-transparent ${sizeClass} text-primary outline-none focus:ring-0 ${sizeVariant === 'sm' ? 'text-[11px]' : ''} ${leadingIcon ? ' ps-12' : ' ps-1'} pe-1 autofill:bg-surface-container-high autofill:text-primary autofill:shadow-[inset_0_0_0px_1000px_var(--color-surface-container-high)] autofill:[-webkit-text-fill-color:var(--color-primary)] ${className}`}
				/>
				{trailingContent ? <span className="shrink-0 px-1">{trailingContent}</span> : null}
			{!readOnly && (
					<button type="button" aria-label="Abrir seletor de tempo" aria-expanded={pickerOpen} disabled={disabled} onClick={() => setPickerOpen((open) => !open)} className="flex h-full w-4 shrink-0 items-center justify-center text-on-surface-variant hover:bg-surface-variant disabled:opacity-50">
						<RiTimeLine aria-hidden="true" />
					</button>
				)}
				{pickerOpen && !disabled && (
					<div className="absolute right-0 top-full z-30 mt-1 flex gap-2 rounded-xl border border-outline-variant bg-surface-container-high p-3 shadow-lg" role="group" aria-label="Selecionar duração">
						<CyclicTimeWheel label="Horas" count={24} value={hours} onChange={(next) => updatePart('hours', next)} />
						<CyclicTimeWheel label="Minutos" count={60} value={minutes} onChange={(next) => updatePart('minutes', next)} />
						<CyclicTimeWheel label="Segundos" count={60} value={remainder} onChange={(next) => updatePart('seconds', next)} />
					</div>
				)}
			</div>
			{hint && !error && <p id={`${inputId}-hint`} className="text-xs text-on-surface-variant/80">{hint}</p>}
			{error && <p id={`${inputId}-error`} role="alert" className="text-sm text-error">{error}</p>}
		</div>
	);
}

export default forwardRef<HTMLInputElement, TimeInputProps>(TimeInput);
