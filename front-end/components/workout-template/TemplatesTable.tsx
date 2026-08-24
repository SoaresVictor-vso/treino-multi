import { RiSearchLine } from 'react-icons/ri';
import TemplateActions from './TemplateActions';
import type { WorkoutTemplateSummary } from '@/gateway/services/workout-templates';

type TemplatesTableProps = {
	templates: WorkoutTemplateSummary[];
	selectedId: string | null;
	query: string;
	actionsTemplateId: string | null;
	onQueryChange: (query: string) => void;
	onSelect: (template: WorkoutTemplateSummary) => void;
	onToggleActions: (template: WorkoutTemplateSummary) => void;
	onEdit: (template: WorkoutTemplateSummary) => void;
	onView: (template: WorkoutTemplateSummary) => void;
	onRemove: (template: WorkoutTemplateSummary) => void;
};

export default function TemplatesTable({
	templates,
	selectedId,
	query,
	actionsTemplateId,
	onQueryChange,
	onSelect,
	onToggleActions,
	onEdit,
	onView,
	onRemove,
}: TemplatesTableProps) {
	return (
		<section className="rounded-lg border border-outline-variant bg-surface-container-low p-5">
			<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<h2 className="type-headline-md">
					Todas as templates
					<span className="ml-2 text-sm font-normal text-on-surface-variant">
						{templates.length}
					</span>
				</h2>
				<label className="flex items-center gap-2 border-b border-outline bg-surface-container px-3 py-2 text-sm focus-within:border-primary-container">
					<span className="text-on-surface-variant">
						<RiSearchLine />
					</span>
					<input
						value={query}
						onChange={(event) => onQueryChange(event.target.value)}
						placeholder="Buscar template"
						className="w-full bg-transparent outline-none placeholder:text-on-surface-variant"
					/>
				</label>
			</div>
			<table className="w-full table-fixed border-separate border-spacing-y-2 text-left">
				<thead className="sr-only">
					<tr>
						<th scope="col">Template</th>
					</tr>
				</thead>
				<tbody>
					{templates.map((template) => (
						<tr
							key={template.id}
							className={
								selectedId === template.id
									? 'bg-surface-container-high'
									: 'hover:bg-surface-container-high'
							}
						>
							<td className="cursor-pointer rounded border border-transparent p-0 first:border-l last:border-r [&:only-child]:border-outline-variant">
								<div className="flex items-center gap-4 p-4">
									<div className="contents">
										<button
											type="button"
											onClick={(event) => {
												console.log('onClick', template.id);
												onToggleActions(template);
												onSelect(template);
											}}
											className="min-w-0 flex-1 text-left"
											aria-label={`Ver prévia de ${template.name}`}
										>
											<div className="flex items-center gap-3">
												<span className="truncate font-bold">{template.name}</span>
												<span className="shrink-0 rounded-sm bg-primary-fixed-dim/15 px-2 py-1 font-mono text-xs text-primary-fixed-dim">
													{template.exercises?.length ?? 0} exercícios
												</span>
											</div>
											<p className="mt-2 truncate text-sm text-on-surface-variant">
												{template.description}
											</p>
										</button>
										<TemplateActions
											template={template}
											isOpen={actionsTemplateId === template.id}
											onToggle={() => onToggleActions(template)}
											onEdit={() => onEdit(template)}
											onView={() => onView(template)}
											onRemove={() => onRemove(template)}
										/>
									</div>
								</div>
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{!templates.length && (
				<p className="py-8 text-center text-on-surface-variant">
					Nenhuma template encontrada.
				</p>
			)}
		</section>
	);
}
