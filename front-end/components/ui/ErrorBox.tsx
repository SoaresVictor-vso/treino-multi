export default function ErrorBox({ message }: { message: string | null }) {
    return (
        message && (
            <p className="bg-error-container/20 text-error p-3 rounded text-[10px] font-bold font-label-caps uppercase tracking-widest border border-error/20">
                {message}
            </p>
        )
    );
}