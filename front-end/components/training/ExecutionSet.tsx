'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import {
	RiArrowGoBackLine,
	RiCheckLine,
	RiDeleteBinLine,
	RiTimeLine,
} from 'react-icons/ri';
import { BiDumbbell } from 'react-icons/bi';
import { MetricField } from '@/components/workout-template/MetricField';
import SeriesIndicator, { seriesTypeClassName } from './SeriesIndicator';
import RpeIndicator from './RpeIndicator';
import RpePicker from './RpePicker';
import SetTypePicker, { setOptions } from './SetTypePicker';
import type {
	ExecutionSetType,
	ExecutionStatus,
	WorkoutExecution,
} from '@/gateway/services/workouts';

const SWIPE_THRESHOLD = 72;
export default function ExecutionSet({
	execution,
	number,
	editable,
	onChange,
	onSkip,
	onStatusChange,
	onRestClick,
}: {
	execution: WorkoutExecution;
	number: number;
	editable: boolean;
	onChange: (key: keyof WorkoutExecution, value: number | string | null) => void;
	onSkip: () => void;
	onStatusChange: (status: ExecutionStatus) => void;
	onRestClick: () => void;
}) {
	const [menuOpen, setMenuOpen] = useState(false);
	const [menuPosition, setMenuPosition] = useState({
		top: 0,
		bottom: 0,
		left: 0,
		maxHeight: 0,
	});
	const [rpePickerOpen, setRpePickerOpen] = useState(false);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [dragStartX, setDragStartX] = useState<number | null>(null);
	const [dragOffset, setDragOffset] = useState(0);
	const locked = !editable || execution.status === 'skipped';
	const fieldsDisabled = locked || execution.status === 'completed';
	const menuDisabled =
		!editable ||
		execution.status === 'skipped' ||
		execution.status === 'completed';
	const value = <T extends number | null>(performed: T, prescribed: T) =>
		performed ?? prescribed ?? null;
	const hasRequiredMetrics =
		value(execution.performedMetric1, execution.prescribedMetric1) !== null &&
		(!execution.exercise.metric_2 ||
			value(execution.performedMetric2, execution.prescribedMetric2) !== null);
	const canComplete =
		editable && execution.status === 'in_progress' && hasRequiredMetrics;
	const canUndo = editable && execution.status === 'completed';
	const draggable = canComplete || canUndo;
	const setOption =
		setOptions.find((option) => option.value === execution.setType) ??
		setOptions[0];
	const hasRpe =
		(execution.prescribedPse ?? 0) > 0 || (execution.performedPse ?? 0) > 0;
	const closeMenu = () => {
		setMenuOpen(false);
		setRpePickerOpen(false);
	};

	useEffect(() => {
		if (!menuOpen) return;
		const closeOnPageScroll = (event: Event) => {
			if (event.target instanceof Node && menuRef.current?.contains(event.target))
				return;
			closeMenu();
		};
		window.addEventListener('resize', closeMenu);
		window.addEventListener('scroll', closeOnPageScroll, true);
		return () => {
			window.removeEventListener('resize', closeMenu);
			window.removeEventListener('scroll', closeOnPageScroll, true);
		};
	}, [menuOpen]);
	const toggleMenu = () => {
		if (menuOpen) return closeMenu();
		const rect = buttonRef.current?.getBoundingClientRect();
		if (rect) {
			const safeSpace = window.innerHeight * 0.1;
			const opensDownward = rect.bottom < window.innerHeight / 2;
			const top = opensDownward ? Math.max(safeSpace, rect.bottom + 8) : 0;
			const bottom = opensDownward
				? 0
				: Math.max(safeSpace, window.innerHeight - rect.top + 8);
			setMenuPosition({
				top,
				bottom,
				left: Math.min(rect.left, window.innerWidth - 224),
				maxHeight: opensDownward
					? window.innerHeight - safeSpace - top
					: window.innerHeight - safeSpace - bottom,
			});
		}
		setMenuOpen(true);
	};
	const finishDrag = (event: PointerEvent<HTMLDivElement>) => {
		if (dragStartX === null) return;
		const offset = event.clientX - dragStartX;
		if (canComplete && offset >= SWIPE_THRESHOLD) onStatusChange('completed');
		if (canUndo && offset <= -SWIPE_THRESHOLD) onStatusChange('in_progress');
		setDragStartX(null);
		setDragOffset(0);
	};
	return (
		<div className="relative overflow-hidden rounded-lg">
			<div
				className="absolute inset-y-0 left-0 flex w-24 items-center justify-center bg-green-600 text-white"
				aria-hidden="true"
			>
				<RiCheckLine size={25} />
			</div>
			<div
				className="absolute inset-y-0 right-0 flex w-24 items-center justify-center bg-secondary-container text-on-secondary-container"
				aria-hidden="true"
			>
				<RiArrowGoBackLine size={22} />
			</div>
			<div
				className={`relative min-w-0 touch-pan-y rounded-lg border px-1.5 py-1.5 ${dragStartX === null ? 'transition-transform duration-200' : ''} ${execution.status === 'completed' ? 'border-outline-variant bg-surface-variant' : 'border-outline-variant bg-surface-container-high'}`}
				style={{ transform: `translateX(${dragOffset}px)` }}
				onPointerDown={(event) => {
					if (!draggable) return;
					setDragStartX(event.clientX);
					event.currentTarget.setPointerCapture(event.pointerId);
				}}
				onPointerMove={(event) => {
					if (dragStartX === null) return;
					const offset = event.clientX - dragStartX;
					setDragOffset(
						canComplete
							? Math.max(0, Math.min(96, offset))
							: Math.min(0, Math.max(-96, offset)),
					);
				}}
				onPointerUp={finishDrag}
				onPointerCancel={() => {
					setDragStartX(null);
					setDragOffset(0);
				}}
			>
				<div
					className="grid min-w-0 items-end gap-1.5"
					style={{
						gridTemplateColumns: `26px minmax(0, 1fr)${execution.exercise.metric_2 ? ' minmax(0, 1fr)' : ''}${execution.prescribedPse !== null || execution.performedPse !== null ? ' auto' : ''}`,
					}}
				>
					<div className="flex items-center justify-center self-center">
						<SeriesIndicator
							ref={buttonRef}
							number={number}
							completed={execution.status === 'completed'}
							tooltip={
								execution.status === 'completed'
									? `Série ${number} concluída — abrir opções`
									: `Abrir opções da série ${number}`
							}
							disabled={menuDisabled}
							onClick={toggleMenu}
							ariaExpanded={menuOpen}
							className={
								seriesTypeClassName[execution.setType] ??
								seriesTypeClassName[setOption.value]
							}
						/>
					</div>
					<MetricField
						metric={execution.exercise.metric_1}
						value={
							value(execution.performedMetric1, execution.prescribedMetric1) ??
							undefined
						}
						type="v"
						disabled={fieldsDisabled}
						inputClassName="text-on-surface"
						compact
						onTypeChange={() => {}}
						onChange={(item) =>
							onChange('performedMetric1', item === '' ? null : Number(item))
						}
					/>
					{execution.exercise.metric_2 && (
						<MetricField
							metric={execution.exercise.metric_2}
							value={
								value(execution.performedMetric2, execution.prescribedMetric2) ??
								undefined
							}
							type={execution.metric2Type ?? 'v'}
							allowPercent
							disabled={fieldsDisabled}
							inputClassName="text-on-surface"
							compact
							onTypeChange={() => {}}
							onChange={(item) =>
								onChange('performedMetric2', item === '' ? null : Number(item))
							}
						/>
					)}
					{hasRpe && (
						<RpeIndicator
							prescribed={execution.prescribedPse}
							performed={execution.performedPse}
							disabled={fieldsDisabled}
							onClick={() => {
								setRpePickerOpen(true);
								toggleMenu();
							}}
						/>
					)}
				</div>
				{execution.status === 'completed' && (
					<div
						className="pointer-events-none absolute inset-0 rounded-lg bg-black/25"
						aria-hidden="true"
					/>
				)}
			</div>
			{menuOpen &&
				typeof document !== 'undefined' &&
				createPortal(
					<div
						className="fixed inset-0 z-40"
						onClick={closeMenu}
						role="presentation"
					>
						<div
							ref={menuRef}
							className="absolute w-52 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container p-2 shadow-2xl"
							style={{
								top: menuPosition.top || undefined,
								bottom: menuPosition.bottom || undefined,
								left: menuPosition.left,
								maxHeight: menuPosition.maxHeight,
							}}
							onClick={(event) => event.stopPropagation()}
							role="menu"
						>
							{rpePickerOpen ? (
								<>
									<button
										type="button"
										onClick={() => setRpePickerOpen(false)}
										className="mb-2 text-xs font-semibold text-primary-fixed-dim"
									>
										← Opções da série
									</button>
									<p className="px-1 pb-2 text-xs font-semibold text-on-surface-variant">
										RPE realizado
									</p>
									<RpePicker
										value={execution.performedPse ?? execution.prescribedPse}
										onChange={(value) => {
											onChange('performedPse', value);
											closeMenu();
										}}
									/>
								</>
							) : (
								<>
									<SetTypePicker
										value={execution.setType}
										number={number}
										onChange={(value) => {
											onChange('setType', value);
											closeMenu();
										}}
									/>
									{!hasRpe && (
										<button
											type="button"
											onClick={() => setRpePickerOpen(true)}
											className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-on-surface-variant hover:bg-primary-fixed-dim/10"
										>
											<BiDumbbell /> RPE
										</button>
									)}
									<button
										type="button"
										onClick={() => {
											closeMenu();
											onRestClick();
										}}
										className={`mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:brightness-110 text-on-surface-variant`}
									>
										<RiTimeLine /> Descanso
									</button>
									<button
										type="button"
										onClick={() => {
											closeMenu();
											onSkip();
										}}
										className="mt-1 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-error hover:bg-error-container/20"
									>
										<RiDeleteBinLine /> Remover
									</button>
								</>
							)}
						</div>
					</div>,
					document.body,
				)}
		</div>
	);
}
