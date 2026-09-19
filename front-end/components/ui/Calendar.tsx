'use client';

import { type ReactNode, useMemo } from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';

export type CalendarEntry = {
	id: string;
	/** Data civil no fuso local do navegador, no formato YYYY-MM-DD. */
	date: string;
};

type CalendarProps<T extends CalendarEntry> = {
	month: Date;
	entries: T[];
	onMonthChange: (month: Date) => void;
	renderEntry: (entry: T) => ReactNode;
	renderDaySummary?: (entries: T[], date: string) => ReactNode;
	onDayClick?: (entries: T[], date: string) => void;
	emptyLabel?: string;
	ariaLabel?: string;
};

const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function atLocalMidnight(date: Date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
	return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function sameDay(first: Date, second: Date) {
	return dateKey(first) === dateKey(second);
}

/**
 * Grade mensal reutilizável: cada célula é um card e as entradas são renderizadas
 * pelo consumidor, permitindo sobrepor cores, links e qualquer informação do domínio.
 */
export default function Calendar<T extends CalendarEntry>({
	month,
	entries,
	onMonthChange,
	renderEntry,
	renderDaySummary,
	onDayClick,
	emptyLabel = 'Nenhuma informação para este dia.',
	ariaLabel = 'Calendário mensal',
}: CalendarProps<T>) {
	const normalizedMonth = useMemo(
		() => new Date(month.getFullYear(), month.getMonth(), 1),
		[month],
	);
	const entriesByDate = useMemo(() => {
		const groups = new Map<string, T[]>();
		for (const entry of entries) {
			groups.set(entry.date, [...(groups.get(entry.date) ?? []), entry]);
		}
		return groups;
	}, [entries]);
	const weeks = useMemo(() => {
		const first = new Date(normalizedMonth.getFullYear(), normalizedMonth.getMonth(), 1);
		const last = new Date(normalizedMonth.getFullYear(), normalizedMonth.getMonth() + 1, 0);
		const start = new Date(first);
		start.setDate(first.getDate() - first.getDay());
		const end = new Date(last);
		end.setDate(last.getDate() + (6 - last.getDay()));
		const result: Date[][] = [];
		for (let cursor = start; cursor <= end; ) {
			const week: Date[] = [];
			for (let day = 0; day < 7; day += 1) {
				week.push(new Date(cursor));
				cursor.setDate(cursor.getDate() + 1);
			}
			result.push(week);
		}
		return result;
	}, [normalizedMonth]);
	const today = atLocalMidnight(new Date());
	const monthLabel = new Intl.DateTimeFormat('pt-BR', {
		month: 'long',
		year: 'numeric',
	}).format(normalizedMonth);

	return (
		<section aria-label={ariaLabel} className="rounded-[1.5rem] border border-white/8 bg-surface-container-low p-3 sm:p-5">
			<div className="mb-4 flex items-center justify-between gap-3">
				<button type="button" aria-label="Mês anterior" onClick={() => onMonthChange(new Date(normalizedMonth.getFullYear(), normalizedMonth.getMonth() - 1, 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-on-surface-variant transition hover:border-primary-fixed hover:text-primary-fixed">
					<RiArrowLeftSLine size={22} />
				</button>
				<h2 className="text-base font-extrabold capitalize sm:text-lg">{monthLabel}</h2>
				<button type="button" aria-label="Próximo mês" onClick={() => onMonthChange(new Date(normalizedMonth.getFullYear(), normalizedMonth.getMonth() + 1, 1))} className="grid h-10 w-10 place-items-center rounded-xl border border-outline-variant text-on-surface-variant transition hover:border-primary-fixed hover:text-primary-fixed">
					<RiArrowRightSLine size={22} />
				</button>
			</div>
			<div className="grid grid-cols-7 gap-1.5 sm:gap-2" role="grid">
				{weekdays.map((day) => <div key={day} role="columnheader" className="pb-1 text-center text-[10px] font-bold uppercase tracking-wide text-on-surface-variant sm:text-xs">{day}</div>)}
				{weeks.flatMap((week) => week.map((day) => {
					const inMonth = day.getMonth() === normalizedMonth.getMonth();
					const dayEntries = entriesByDate.get(dateKey(day)) ?? [];
					const isToday = sameDay(day, today);
					const className = `aspect-[9/16] w-full overflow-hidden rounded-xl border p-1.5 text-left transition sm:p-2 ${inMonth ? 'border-outline-variant bg-surface-container' : 'border-white/5 bg-surface-container-lowest/50 text-on-surface-variant/45'} ${isToday ? 'ring-1 ring-primary-fixed' : ''} ${onDayClick && dayEntries.length ? 'cursor-pointer hover:border-primary-fixed hover:bg-surface-container-high focus:outline-none focus:ring-2 focus:ring-primary-fixed' : ''}`;
					const content = <div className="flex h-full flex-col"><span className={`mb-1 text-right text-[10px] font-bold sm:text-xs ${isToday ? 'text-primary-fixed' : ''}`}>{day.getDate()}</span><div className="min-h-0 flex-1">{dayEntries.length ? renderDaySummary ? renderDaySummary(dayEntries, dateKey(day)) : dayEntries.map((entry) => <div key={entry.id}>{renderEntry(entry)}</div>) : inMonth ? <span className="sr-only">{emptyLabel}</span> : null}</div></div>;
					return onDayClick && dayEntries.length ? (
						<button key={dateKey(day)} type="button" role="gridcell" aria-label={`${dayEntries.length} treino${dayEntries.length === 1 ? '' : 's'} em ${day.getDate()} de ${monthLabel}`} className={className} onClick={() => onDayClick(dayEntries, dateKey(day))}>{content}</button>
					) : <div key={dateKey(day)} role="gridcell" aria-label={`${day.getDate()} de ${monthLabel}`} className={className}>{content}</div>;
				}))}
			</div>
		</section>
	);
}

export function localDateKey(value: string | Date) {
	if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
	const date = value instanceof Date ? value : new Date(value);
	return dateKey(date);
}
