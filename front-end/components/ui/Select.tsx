import { forwardRef, ReactNode, SelectHTMLAttributes } from "react";
import { RiArrowDownSLine } from "react-icons/ri";

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  hint?: string;
  options: SelectOption[];
  placeholder?: string;
  leadingIcon?: ReactNode;
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, id, options, placeholder, className = "", leadingIcon, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        <div
          className={`relative rounded-xl border border-outline-variant bg-surface-container-high transition-colors ${
            error ? "border-error/60" : "focus-within:border-primary-fixed-dim/50"
          }`}
        >
          {leadingIcon ? (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              {leadingIcon}
            </span>
          ) : null}
          <select
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            className={
              "w-full appearance-none rounded-xl bg-surface-container-high px-3 py-3 text-primary outline-none focus:ring-0 " +
              (leadingIcon ? " pl-10" : "") +
              " pr-10 [color-scheme:dark] autofill:bg-surface-container-high autofill:text-primary autofill:shadow-[inset_0_0_0px_1000px_var(--color-surface-container-high)] autofill:[-webkit-text-fill-color:var(--color-primary)] " +
              className
            }
            {...props}
          >
            {(placeholder || label) && (
              <option value="" disabled className="bg-surface-container-high text-on-surface-variant">
                {placeholder ?? label}
              </option>
            )}
            {options.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={opt.disabled}
                className="bg-surface-container-high text-primary"
              >
                {opt.label}
              </option>
            ))}
          </select>
          <RiArrowDownSLine className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-on-surface-variant" />
        </div>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-on-surface-variant/80">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-error">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
