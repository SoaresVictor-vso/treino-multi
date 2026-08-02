import { authenticatedRequest } from '@/api/client';
import { indexedDbService, type IndexedDbEntity } from '@/lib/indexeddb';
import {
	createFulltextSearch,
	type FulltextSearch,
} from '@/lib/Fulltextsearch';
import { Metric } from './metrics';

export type ExerciseParameter = IndexedDbEntity & {
	id: string;
	name: string;
	description: string;
	metric1Id: number;
	metric2Id?: number | null;
	visualUrl?: string | null;
};

export type Exercise = {
	id: number;
	name: string;
	description: string;
	metric_1: Metric;
	metric_2?: Metric;
	visual_url?: string;
};

type ExerciseSyncResponse = {
	exercises: Array<ExerciseParameter>;
	deletedIds: number[];
	syncedAt: string;
};

type ExerciseSearchDocument = {
	id: string;
	name: string;
	description: string;
	metric1Id: string;
	metric2Id: string;
	visualUrl: string;
};

export interface ExercisesServiceContract {
	buscar(since: string | null): Promise<ExerciseSyncResponse>;
	syncCatalog(): Promise<ExerciseParameter[]>;
	search(query: string): Promise<ExerciseParameter[]>;
}

const EXERCISES_STORE = 'exercises';
const EXERCISES_SYNC_CURSOR_KEY = 'last_sync_exercises';

export class ExercisesService implements ExercisesServiceContract {
	private readonly index: FulltextSearch<ExerciseSearchDocument> =
		createFulltextSearch({
			fields: ['id', 'name', 'description'],
			storeFields: [
				'id',
				'name',
				'description',
				'metric1Id',
				'metric2Id',
				'visualUrl',
			],
			searchOptions: {
				combineWith: 'OR',
				fuzzy: 0.6,
				prefix: true,
				weights: { fuzzy: 1, prefix: 0.2 },
				boost: { name: 4, description: 1 },
			},
			normalize: (term) => this.normalize(term),
		});

	private documents: ExerciseSearchDocument[] = [];

	public async buscar(since: string | null): Promise<ExerciseSyncResponse> {
		const endpoint = since
			? `exercises/sync?since=${encodeURIComponent(since)}`
			: 'exercises/sync';

		const response = await authenticatedRequest<ExerciseSyncResponse>(endpoint);
		if (!response.success || !response.data) {
			return {
				exercises: [],
				deletedIds: [],
				syncedAt: since ?? new Date(0).toISOString(),
			};
		}

		return response.data;
	}

	public async syncCatalog(): Promise<ExerciseParameter[]> {
		const since =
			typeof localStorage !== 'undefined'
				? localStorage.getItem(EXERCISES_SYNC_CURSOR_KEY)
				: null;
		const { exercises, deletedIds, syncedAt } = await this.buscar(since);

		const normalized = exercises.map((exercise) => ({
			id: exercise.id.toString(),
			name: exercise.name,
			description: exercise.description ?? '',
			metric1Id: exercise.metric1Id,
			metric2Id: exercise.metric2Id ?? null,
			visualUrl: exercise.visualUrl ?? null,
		}));

		if (normalized.length > 0) {
			await indexedDbService.anexar<ExerciseParameter>(
				EXERCISES_STORE,
				normalized,
			);
		}

		const toDelete = deletedIds.map((id) => id.toString());
		if (toDelete.length > 0) {
			await indexedDbService.remover(EXERCISES_STORE, toDelete);
		}

		if (typeof localStorage !== 'undefined' && syncedAt) {
			localStorage.setItem(EXERCISES_SYNC_CURSOR_KEY, syncedAt);
		}

		const exercisesCache =
			await indexedDbService.search<ExerciseParameter>(EXERCISES_STORE);
		this.rebuildIndex(exercisesCache);
		return exercisesCache;
	}

	public async search(query: string): Promise<ExerciseParameter[]> {
		const catalog = await this.syncCatalog();
		const normalizedQuery = query.trim().toLocaleUpperCase();

		if (!normalizedQuery) return catalog;

		return this.index.search(this.normalize(normalizedQuery)).map((result) => ({
			id: result.id,
			name: result.name,
			description: result.description,
			metric1Id: Number(result.metric1Id),
			metric2Id: result.metric2Id ? Number(result.metric2Id) : null,
			visualUrl: result.visualUrl,
		}));
	}

	private rebuildIndex(items: ExerciseParameter[]): void {
		this.documents = items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description,
			metric1Id: String(item.metric1Id),
			metric2Id: item.metric2Id == null ? '' : String(item.metric2Id),
			visualUrl: item.visualUrl ?? '',
		}));

		this.index.removeAll();
		if (this.documents.length > 0) this.index.addAll(this.documents);
	}

	private normalize(text: string): string {
		return text
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase();
	}
}

export const exercisesService = new ExercisesService();
