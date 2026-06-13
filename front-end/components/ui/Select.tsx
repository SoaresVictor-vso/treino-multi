import { forwardRef, SelectHTMLAttributes } from "react";

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
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, hint, id, options, placeholder, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-lg font-bold text-gray-100 ps-1">
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={[
            "w-full rounded-lg border px-3 py-2 text-lg outline-none transition appearance-none bg-no-repeat text-gray-100",
            "focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-gray-800",
            error
              ? "border-red-500 bg-red-50 focus:ring-red-400 focus:border-red-500"
              : "border-gray-300 bg-gray-800",
            props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            backgroundPosition: "right 0.75rem center",
            backgroundSize: "12px",
            paddingRight: "2.5rem",
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value} disabled={opt.disabled}>
              {opt.label}
            </option>
          ))}
        </select>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-gray-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = "Select";

export default Select;
