import { ChangeEvent, forwardRef, InputHTMLAttributes, useEffect, useState } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", placeholder, onChange, value, defaultValue, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    const resolveHasValue = (currentValue: InputProps["value"] | InputProps["defaultValue"]) => {
      if (typeof currentValue === "number") return true;
      if (typeof currentValue === "string") return currentValue.length > 0;
      return false;
    };

    const [hasValue, setHasValue] = useState(() => {
      return resolveHasValue(value) || resolveHasValue(defaultValue);
    });

    useEffect(() => {
      if (value !== undefined) {
        setHasValue(resolveHasValue(value));
      }
    }, [value]);

    const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
      if (value === undefined) {
        setHasValue(event.target.value.length > 0);
      }

      onChange?.(event);
    };

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className={`min-h-4 text-xs leading-none transition-opacity ${hasValue ? "opacity-100 text-primary" : "opacity-0"}`}
          >
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            placeholder={hasValue ? "" : (placeholder ?? label)}
            className={
              "w-full bg-surface-container-high border border-outline-variant p-2 text-primary focus:ring-0 " +
              "autofill:bg-surface-container-high autofill:text-primary autofill:shadow-[inset_0_0_0px_1000px_var(--color-surface-container-high)] autofill:[-webkit-text-fill-color:var(--color-primary)] " +
              className
            }
            onChange={handleChange}
            value={value}
            defaultValue={defaultValue}
            {...props}
          />
        </div>
        {hint && !error && (
          <p id={`${inputId}-hint`} className="text-xs text-gray-500">
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
  }
);

Input.displayName = "Input";

export default Input;
