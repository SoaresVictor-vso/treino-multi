import {
	ChangeEvent,
	forwardRef,
	TextareaHTMLAttributes,
	useEffect,
	useState,
} from 'react';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
	label?: string;
	error?: string;
	hint?: string;
	showCharacterCount?: boolean;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	(
		{
			label,
			error,
			hint,
			id,
			className = '',
			onChange,
			value,
			defaultValue,
			maxLength,
			required,
			showCharacterCount = typeof maxLength === 'number',
			...props
		},
		ref,
	) => {
		const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
		const getLength = (currentValue: TextareaProps['value']) =>
			typeof currentValue === 'string' ? currentValue.length : 0;
		const [characterCount, setCharacterCount] = useState(() =>
			getLength(value ?? defaultValue),
		);

		useEffect(() => {
			if (value !== undefined) setCharacterCount(getLength(value));
		}, [value]);

		const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
			if (value === undefined) setCharacterCount(event.target.value.length);
			onChange?.(event);
		};
		const labelText = required && label ? `${label} *` : label;
		const describedBy =
			[
				error ? `${inputId}-error` : undefined,
				hint ? `${inputId}-hint` : undefined,
			]
				.filter(Boolean)
				.join(' ') || undefined;

		return (
			<div className="flex flex-col gap-1">
				{labelText && (
					<label
						htmlFor={inputId}
						className="flex items-center justify-between text-sm font-semibold"
					>
						<span>{labelText}</span>
						{showCharacterCount && typeof maxLength === 'number' && (
							<span className="font-mono text-xs text-on-surface-variant">
								{characterCount}/{maxLength}
							</span>
						)}
					</label>
				)}
				<textarea
					ref={ref}
					id={inputId}
					aria-invalid={!!error}
					aria-describedby={describedBy}
					className={`w-full resize-none rounded-xl border border-outline-variant bg-surface-container-high px-3 py-3 text-primary outline-none transition-colors focus:border-primary-fixed-dim ${error ? 'border-error/60' : ''} ${className}`}
					onChange={handleChange}
					value={value}
					defaultValue={defaultValue}
					maxLength={maxLength}
					required={required}
					{...props}
				/>
				{hint && !error && (
					<p id={`${inputId}-hint`} className="text-xs text-on-surface-variant/80">
						{hint}
					</p>
				)}
				{error && (
					<p id={`${inputId}-error`} role="alert" className="text-sm text-error">
						{error}
					</p>
				)}
			</div>
		);
	},
);

Textarea.displayName = 'Textarea';

export default Textarea;
