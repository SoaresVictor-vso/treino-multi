export default function Button(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & { text?: string; variant?: "default" | "outline" }
) {
    const { children, variant, ...rest } = props
    // function getColor() {
    //     switch (buttonStyle) {
    //         case "danger":
    //             return "bg-red-600 hover:bg-red-700 focus:ring-red-500";
    //         case "default":
    //         default:
    //             return "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500";
    //     }
    // }
    const baseClass = "px-4 py-3 rounded-lg flex items-center justify-center gap-2 kinetic-glow transition-all  font-bold ";

    const classOutline = "px-4 rounded border border-outline-variant text-on-surface-variant hover:bg-surface-variant transition-colors"
    const classDefault = "bg-primary-container text-on-primary-container";
    return (
        <button
            {...rest}
            // className={
            //     `w-full rounded-lg px-4 py-2 text-sm font-semibold text-white` +
            //     ` focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50` +
            //     `disabled:cursor-not-allowed transition-colors ${getColor()}` +
            //     ` ${props.className || ""}`}

            className={
                `${variant === "outline" ? classOutline : classDefault} ${baseClass} ${props.className || ""}`}
        >
            {children || (props.text ? <span className="text-white">{props.text}</span> : null)}
        </button>
    )
}