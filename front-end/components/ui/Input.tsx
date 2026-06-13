import { forwardRef, InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = "", ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, "-");

    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-lg font-bold text-gray-100 ps-1"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
          className={[
            "w-full rounded-lg border border-gray-300 px-3 py-2 text-lg text-gray-100 ",
            "placeholder-gray-400 focus:outline-none focus:ring-2",
            "focus:ring-indigo-500 focus:border-transparent",
            "autofill:bg-gray-800 autofill:text-gray-100 autofill:shadow-[inset_0_0_0px_1000px_rgb(31,41,55)] autofill:[-webkit-text-fill-color:rgb(243,244,246)]",
            error
              ? "border-red-500 bg-red-50 focus:ring-red-400 focus:border-red-500"
              : "border-gray-300 bg-gray-800",
            props.disabled ? "cursor-not-allowed opacity-50" : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />
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

Input.displayName = "Input";

export default Input;
