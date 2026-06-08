export default function Button(
    props: React.ButtonHTMLAttributes<HTMLButtonElement> & { buttonStyle: "default" | "danger" }
) {
    const { buttonStyle, children, ...rest } = props
    function getColor() {
        switch (buttonStyle) {
            case "danger":
                return "bg-red-600 hover:bg-red-700 focus:ring-red-500";
            case "default":
            default:
                return "bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500";
        }
    }

    return (
        <button
            {...rest}
            className={
                `w-full rounded-lg px-4 py-2 text-sm font-semibold text-white` +
                ` focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50` +
                `disabled:cursor-not-allowed transition-colors ${getColor()}`}
        >
            {children}
        </button>
    )
}