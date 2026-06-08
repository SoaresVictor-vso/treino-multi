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
            "flex items-start gap-3",
            props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          ].join(" ")}
        >
          {/* Track */}
          <div className="relative flex-shrink-0 mt-0.5">
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
                "w-11 h-6 rounded-full transition-colors",
                "peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-blue-500",
                error
                  ? "bg-red-200 peer-checked:bg-red-500"
                  : "bg-gray-200 peer-checked:bg-blue-600",
                className,
              ]
                .filter(Boolean)
                .join(" ")}
            />
            {/* Thumb */}
            <div className="absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform peer-checked:translate-x-5 pointer-events-none" />
          </div>

          {/* Label + description */}
          {(label || description) && (
            <div className="flex flex-col">
              {label && (
                <span className="text-sm font-medium text-gray-700">{label}</span>
              )}
              {description && (
                <span className="text-xs text-gray-500">{description}</span>
              )}
            </div>
          )}
        </label>

        {error && (
          <p id={`${inputId}-error`} role="alert" className="text-xs text-red-600 ml-14">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Switch.displayName = "Switch";

export default Switch;
