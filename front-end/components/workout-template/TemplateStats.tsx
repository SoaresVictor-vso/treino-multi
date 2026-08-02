type TemplateStatsProps = {
	templateCount: number;
	exerciseCount: number;
};

function Stat({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg border border-outline-variant bg-surface-container-low p-4">
			<p className="type-label-caps text-on-surface-variant">{label}</p>
			<p className="mt-2 text-2xl font-bold text-primary-fixed-dim">{value}</p>
		</div>
	);
}

export default function TemplateStats({
	templateCount,
	exerciseCount,
}: TemplateStatsProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<Stat label="Templates ativas" value={templateCount} />
			<Stat label="Exercícios cadastrados" value={exerciseCount} />
			<Stat label="Última atualização" value="Hoje" />
		</div>
	);
}
