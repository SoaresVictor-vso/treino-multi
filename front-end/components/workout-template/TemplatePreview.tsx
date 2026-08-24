import { RiHeartPulseLine } from 'react-icons/ri';
import type { WorkoutTemplateSummary } from '@/gateway/services/workout-templates';

export default function TemplatePreview({
	template,
}: {
	template: WorkoutTemplateSummary;
}) {
	return (
		<aside className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
			<p className="type-label-caps text-primary-fixed-dim">Prévia da template</p>
			<h2 className="mt-2 text-xl font-bold">{template.name}</h2>
			<p className="mt-3 text-sm leading-6 text-on-surface-variant">
				{template.description}
			</p>
			<h3 className="type-label-caps mb-3 mt-6 text-on-surface-variant">
				Sequência
			</h3>
			<div className="space-y-2">
				{template.exercises?.map((exercise, index) => (
					<div
						key={exercise}
						className="flex items-center gap-3 rounded border border-outline-variant bg-surface-container p-3"
					>
						<span className="font-mono text-primary-fixed-dim">
							{String(index + 1).padStart(2, '0')}
						</span>
						<span className="text-on-surface-variant">
							<RiHeartPulseLine />
						</span>
						<span className="text-sm font-semibold">{exercise}</span>
					</div>
				))}
			</div>
		</aside>
	);
}
