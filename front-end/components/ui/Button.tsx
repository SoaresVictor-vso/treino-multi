import { ButtonHTMLAttributes } from "react";

type ButtonVariant = "default" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "icon";

export default function Button(
    props: ButtonHTMLAttributes<HTMLButtonElement> & {
        text?: string;
        variant?: ButtonVariant;
        size?: ButtonSize;
    },
) {
    const {
        children,
        variant = "default",
        size = "md",
        className = "",
        text,
        type = "button",
        ...rest
    } = props;

    const baseClass =
        "inline-flex items-center justify-center gap-2 rounded-xl font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-fixed-dim/30 disabled:cursor-not-allowed disabled:opacity-50";

    const variantClasses: Record<ButtonVariant, string> = {
        default: "bg-primary-container text-on-primary-fixed hover:shadow-[0_0_18px_rgba(195,244,0,0.18)] hover:-translate-y-0.5",
        outline: "border border-outline-variant bg-transparent text-on-surface-variant hover:border-primary-fixed-dim/40 hover:bg-surface-variant/60 hover:text-primary",
        ghost: "bg-transparent text-on-surface-variant hover:bg-surface-variant/50 hover:text-primary",
    };

    const sizeClasses: Record<ButtonSize, string> = {
        sm: "min-h-10 px-3 py-2 text-sm",
        md: "min-h-12 px-4 py-3",
        icon: "h-10 w-10 p-0",
    };

    return (
        <button
            {...rest}
            type={type}
            className={`${baseClass} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`.trim()}
        >
            {children || (text ? <span>{text}</span> : null)}
        </button>
    );
}
