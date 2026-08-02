'use client';

import { useEffect, useRef, useState } from 'react';
import { RiArrowRightSLine } from 'react-icons/ri';
import type { Template } from './types';

type TemplateActionsProps = {
	template: Template;
	isOpen: boolean;
	onToggle: () => void;
	onEdit: () => void;
	onView: () => void;
	onRemove: () => void;
};

export default function TemplateActions({
	template,
	isOpen,
	onToggle,
	onEdit,
	onView,
	onRemove,
}: TemplateActionsProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [openAbove, setOpenAbove] = useState(false);

	useEffect(() => {
		if (!isOpen) return;

		const updatePosition = () => {
			const bounds = containerRef.current?.getBoundingClientRect();
			if (!bounds) return;

			const menuHeight = 124;
			const spaceBelow = window.innerHeight - bounds.bottom;
			const spaceAbove = bounds.top;
			setOpenAbove(spaceBelow < menuHeight && spaceAbove > spaceBelow);
		};

		updatePosition();
		window.addEventListener('resize', updatePosition);
		window.addEventListener('scroll', updatePosition, true);

		return () => {
			window.removeEventListener('resize', updatePosition);
			window.removeEventListener('scroll', updatePosition, true);
		};
	}, [isOpen]);

	return (
		<div ref={containerRef} className="relative shrink-0">
			<button
				type="button"
				onClick={onToggle}
				className="text-primary-fixed-dim transition-colors hover:text-primary"
				aria-label={`Abrir ações de ${template.title}`}
				aria-expanded={isOpen}
			>
				<RiArrowRightSLine size={24} />
			</button>
			{isOpen && (
				<div
					className={`absolute right-0 z-10 w-36 rounded border border-outline-variant bg-surface-container p-1 shadow-xl ${openAbove ? 'bottom-full mb-1' : 'top-full mt-1'}`}
				>
					<button
						type="button"
						onClick={onEdit}
						className="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container-high"
					>
						Editar
					</button>
					<button
						type="button"
						onClick={onView}
						className="w-full rounded px-3 py-2 text-left text-sm hover:bg-surface-container-high"
					>
						Visualizar
					</button>
					<button
						type="button"
						onClick={onRemove}
						className="w-full rounded px-3 py-2 text-left text-sm text-error hover:bg-error-container/20"
					>
						Remover
					</button>
				</div>
			)}
		</div>
	);
}
