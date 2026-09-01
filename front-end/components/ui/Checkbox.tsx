import { forwardRef, InputHTMLAttributes } from 'react';

export interface CheckboxProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'type'
> {
	label?: string;
	description?: string;
	error?: string;
}

const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
	({ label, description, error, id, className = '', ...props }, ref) => {
		const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');

		return (
			<div className="flex flex-col gap-1">
				<label
					htmlFor={inputId}
					className={[
						'flex items-start gap-3',
						props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
					].join(' ')}
				>
					<input
						ref={ref}
						id={inputId}
						type="checkbox"
						aria-describedby={error ? `${inputId}-error` : undefined}
						className={[
							'mt-0.5 h-4 w-4 flex-shrink-0 rounded border border-outline-variant bg-surface-container-high accent-primary-container',
							'focus:ring-2 focus:ring-primary-fixed-dim/30 focus:ring-offset-2 focus:ring-offset-surface-container',
							'transition cursor-pointer',
							error ? 'border-error accent-error focus:ring-error/30' : '',
							props.disabled ? 'cursor-not-allowed' : '',
							className,
						]
							.filter(Boolean)
							.join(' ')}
						{...props}
					/>
					{(label || description) && (
						<div className="flex flex-col">
							{label && (
								<span className="text-sm font-medium text-on-surface">{label}</span>
							)}
							{description && (
								<span className="text-xs text-on-surface-variant">{description}</span>
							)}
						</div>
					)}
				</label>

				{error && (
					<p
						id={`${inputId}-error`}
						role="alert"
					className="ml-7 text-xs text-error"
					>
						{error}
					</p>
				)}
			</div>
		);
	},
);

Checkbox.displayName = 'Checkbox';

export default Checkbox;
