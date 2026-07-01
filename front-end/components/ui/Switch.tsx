import { forwardRef, InputHTMLAttributes } from "react";

export interface SwitchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
  description?: string;
  error?: string;
}

const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ label, description, error, id, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        <label
          htmlFor={inputId}
          className={[
            "flex items-start gap-3 rounded-2xl border border-outline-variant bg-surface-container-high/70 px-4 py-3",
            props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ].join(" ")}
        >
          <div className="relative mt-0.5 flex-shrink-0">
            <input
              ref={ref}
              id={inputId}
              type="checkbox"
              role="switch"
              aria-checked={props.checked}
              aria-describedby={error ? `${inputId}-error` : undefined}
              className="peer sr-only"
              {...props}
            />
            <div
              className={[
                "h-6 w-11 rounded-full border transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-primary-fixed-dim/30",
                error
                  ? "border-error/50 bg-error/20 peer-checked:bg-error/60"
                  : "border-outline-variant bg-surface-variant peer-checked:border-primary-fixed-dim/40 peer-checked:bg-primary-container",
                className,
              ]
                .filter(Boolean)
                .join(" ")}
            />
            <div className="pointer-events-none absolute top-1 left-1 h-4 w-4 rounded-full bg-primary transition-transform peer-checked:translate-x-5" />
          </div>

          {(label || description) && (
            <div className="flex flex-col">
              {label && (
                <span className="text-sm font-medium text-primary">{label}</span>
              )}
              {description && (
                <span className="text-xs text-on-surface-variant">{description}</span>
              )}
            </div>
          )}
        </label>

        {error && (
          <p id={`${inputId}-error`} role="alert" className="ml-14 text-xs text-error">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
