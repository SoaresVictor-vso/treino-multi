import { ChangeEvent, ReactNode, forwardRef, InputHTMLAttributes, useEffect, useState } from "react";

export type InputMask = {
  regex: RegExp;
  replacement: string;
};

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  mask?: InputMask;
  leadingIcon?: ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", placeholder, onChange, value, defaultValue, mask, type, leadingIcon, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");
    if (props.required && label)
      label = `${label} *`;

    const resolveHasValue = (currentValue: InputProps["value"] | InputProps["defaultValue"]) => {
      if (typeof currentValue === "number") return true;
      if (typeof currentValue === "string") return currentValue.length > 0;
      return false;
    };
    const canApplyMask = (type ?? "text") === "text" && !!mask;
    const applyMask = (currentValue: string) => {
      if (!canApplyMask) return currentValue;

      const normalizedValue = currentValue.replace(/\D/g, "");
      const maskedValue = normalizedValue.replace(mask.regex, mask.replacement);

      return maskedValue.replace(/[^\dA-Za-z]+$/g, "");
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
      if (canApplyMask) {
        event.target.value = applyMask(event.target.value);
      }

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
          <input
            ref={ref}
            id={inputId}
            aria-invalid={!!error}
            aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
            placeholder={hasValue ? "" : (placeholder ?? label)}
            className={
              "w-full rounded-xl bg-transparent py-3 text-primary outline-none focus:ring-0 " +
              (leadingIcon ? " ps-12 pe-3" : " px-3") +
              " autofill:bg-surface-container-high autofill:text-primary autofill:shadow-[inset_0_0_0px_1000px_var(--color-surface-container-high)] autofill:[-webkit-text-fill-color:var(--color-primary)] " +
              className
            }
            onChange={handleChange}
            value={typeof value === "string" ? applyMask(value) : value}
            defaultValue={typeof defaultValue === "string" ? applyMask(defaultValue) : defaultValue}
            type={type}
            {...props}
          />
        </div>
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
  }
);

Input.displayName = "Input";

export default Input;
