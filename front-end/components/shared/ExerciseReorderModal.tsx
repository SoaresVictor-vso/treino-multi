'use client';

import { useEffect, useRef, useState } from 'react';
import { RiDraggable } from 'react-icons/ri';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

export type ReorderableExercise = { id: number; name: string };

export default function ExerciseReorderModal({
	isOpen,
	exercises,
	onClose,
	onApply,
}: {
	isOpen: boolean;
	exercises: ReorderableExercise[];
	onClose: () => void;
	onApply: (exerciseIds: number[]) => void;
}) {
	const [orderedExercises, setOrderedExercises] = useState(exercises);
	const [draggedId, setDraggedId] = useState<number | null>(null);
	const draggedExerciseId = useRef<number | null>(null);
	const lastPointerTargetId = useRef<number | null>(null);
	const pointerDragActive = useRef(false);

	useEffect(() => {
		if (isOpen) setOrderedExercises(exercises);
	// Parent components often build this array inline, giving it a new identity
	// on every render. Resetting on that identity change discards an in-progress
	// reorder, so only take the source order when the modal opens.
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isOpen]);

	const moveExercise = (draggedExerciseId: number, targetExerciseId: number) => {
		if (draggedExerciseId === targetExerciseId) return;
		setOrderedExercises((current) => {
			const draggedIndex = current.findIndex(({ id }) => id === draggedExerciseId);
			const targetIndex = current.findIndex(({ id }) => id === targetExerciseId);
			if (draggedIndex < 0 || targetIndex < 0) return current;
			const next = [...current];
			const [dragged] = next.splice(draggedIndex, 1);
			next.splice(targetIndex, 0, dragged);
			return next;
		});
	};
	const endDrag = () => {
		draggedExerciseId.current = null;
		lastPointerTargetId.current = null;
		pointerDragActive.current = false;
		setDraggedId(null);
	};

	return (
		<Modal
			isOpen={isOpen}
			title="Reordenar exercícios"
			description="Arraste os exercícios para definir a ordem de execução."
			onClose={onClose}
		>
			<ul className="space-y-2" aria-label="Exercícios selecionados">
				{orderedExercises.map((exercise) => (
					<li
						key={exercise.id}
						data-exercise-id={exercise.id}
						draggable
						onDragStart={(event) => {
							draggedExerciseId.current = exercise.id;
							setDraggedId(exercise.id);
							event.dataTransfer.effectAllowed = 'move';
						}}
						onDragOver={(event) => event.preventDefault()}
						onDrop={(event) => {
							event.preventDefault();
							if (draggedExerciseId.current !== null)
								moveExercise(draggedExerciseId.current, exercise.id);
							endDrag();
						}}
						onDragEnd={endDrag}
						onPointerDown={(event) => {
							if (event.pointerType === 'mouse') return;
							pointerDragActive.current = true;
							draggedExerciseId.current = exercise.id;
							setDraggedId(exercise.id);
						}}
						onPointerMove={(event) => {
							if (!pointerDragActive.current) return;
							const sourceId = draggedExerciseId.current;
							if (sourceId === null) return;
							const target = document
								.elementFromPoint(event.clientX, event.clientY)
								?.closest<HTMLElement>('[data-exercise-id]');
							const targetId = Number(target?.dataset.exerciseId);
							if (!targetId) {
								lastPointerTargetId.current = null;
								return;
							}
							// The dragged row moves beneath a stationary pointer. Ignore
							// repeated events over the same row to avoid undoing the move.
							if (lastPointerTargetId.current === targetId) return;
							lastPointerTargetId.current = targetId;
							moveExercise(sourceId, targetId);
						}}
						onPointerUp={endDrag}
						onPointerCancel={endDrag}
						className={`flex touch-none cursor-grab items-center gap-3 rounded-lg border border-outline-variant bg-surface-container-high px-4 py-3 font-semibold active:cursor-grabbing ${draggedId === exercise.id ? 'opacity-50' : ''}`}
					>
						<RiDraggable className="shrink-0 text-on-surface-variant" size={20} />
						<span>{exercise.name}</span>
					</li>
				))}
			</ul>
			<div className="mt-6 flex justify-end gap-3">
				<Button variant="outline" onClick={onClose}>
					Cancelar
				</Button>
				<Button
					onClick={() => {
						onApply(orderedExercises.map(({ id }) => id));
						onClose();
					}}
				>
					Aplicar ordem
				</Button>
			</div>
		</Modal>
	);
}
