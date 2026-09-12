import { authenticatedRequest } from '@/gateway/client';
import { indexedDbService, type IndexedDbEntity } from '@/lib/indexeddb';
import { create, insertMultiple, search } from '@orama/orama';
import { stemmer } from '@orama/stemmers/portuguese';
import { Metric } from './metrics';

export type ExerciseParameter = IndexedDbEntity & {
	id: string;
	name: string;
	description: string;
	metric1Id: number;
	metric2Id?: number | null;
	tenantId?: string | null;
	visualUrl?: string | null;
};

export type ExerciseSearchResult = ExerciseParameter & {
	scorePonderado: number;
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

export interface ExercisesServiceContract {
	buscar(since: string | null): Promise<ExerciseSyncResponse>;
	syncCatalog(): Promise<ExerciseParameter[]>;
	search(query: string): Promise<ExerciseSearchResult[]>;
}

export type CreateExerciseInput = {
	name: string;
	description?: string;
	metric1Id: number;
	metric2Id?: number;
	visualUrl?: string;
};

const EXERCISES_STORE = 'exercises';
const EXERCISES_SYNC_CURSOR_KEY = 'last_sync_exercises';
const STEMMED_SEARCH_WEIGHT = 5;
const TYPO_TOLERANT_SEARCH_WEIGHT = 1;
const COMMON_PORTUGUESE_SUFFIXES = [
	'amentos',
	'imentos',
	'amento',
	'imento',
	'adoras',
	'adores',
	'adora',
	'ador',
	'ações',
	'acao',
	'acoes',
	'ições',
	'icao',
	'icoes',
	'idades',
	'idade',
	'mentes',
	'mente',
	'istas',
	'ista',
	'ismos',
	'ismo',
	'ivos',
	'ivas',
	'ivo',
	'iva',
	'osos',
	'osas',
	'oso',
	'osa',
	'entes',
	'ente',
	'ando',
	'endo',
	'indo',
	'adas',
	'idos',
	'ada',
	'ido',
	'ations',
	'ation',
	'ments',
	'ment',
	'ingly',
	'edly',
	'ness',
	'less',
	'ful',
	'ities',
	'ity',
	'ied',
	'ies',
	'ing',
	'ers',
	'er',
	'ed',
	'ly',
];

const removeCommonSuffix = (term: string) => {
	const normalizedTerm = term.toLocaleLowerCase();
	const suffix = COMMON_PORTUGUESE_SUFFIXES.find((item) =>
		normalizedTerm.endsWith(item),
	);
	if (!suffix) return normalizedTerm;

	const radical = normalizedTerm.slice(0, -suffix.length);
	return radical.length >= 3 ? radical : normalizedTerm;
};

const createStemmedCatalogIndex = () =>
	create({
		schema: {
			name: 'string',
			description: 'string',
			metric1Id: 'number',
			metric2Id: 'number',
			visualUrl: 'string',
		},
		components: {
			tokenizer: { language: 'portuguese', stemmer },
		},
	});

const createTypoTolerantCatalogIndex = () =>
	create({
		schema: {
			name: 'string',
			description: 'string',
			metric1Id: 'number',
			metric2Id: 'number',
			visualUrl: 'string',
		},
		language: 'portuguese',
	});

export class ExercisesService implements ExercisesServiceContract {
	private syncPromise: Promise<ExerciseParameter[]> | null = null;
	private stemmedIndex = createStemmedCatalogIndex();
	private typoTolerantIndex = createTypoTolerantCatalogIndex();
	private catalogSize = 0;
	private isIndexReady = false;

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
		if (!this.syncPromise) {
			this.syncPromise = this.syncCatalogOnce().finally(() => {
				this.syncPromise = null;
			});
		}

		return this.syncPromise;
	}

	private async syncCatalogOnce(): Promise<ExerciseParameter[]> {
		const since =
			typeof localStorage !== 'undefined'
				? localStorage.getItem(EXERCISES_SYNC_CURSOR_KEY)
				: null;
		const { exercises, deletedIds, syncedAt } = await this.buscar(since);

		const normalized = exercises?.map((exercise) => ({
			id: exercise.id.toString(),
			name: exercise.name,
			description: exercise.description ?? '',
			metric1Id: exercise.metric1Id,
			metric2Id: exercise.metric2Id ?? null,
			tenantId: exercise.tenantId ?? null,
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
		await this.rebuildIndex(exercisesCache);
		return exercisesCache;
	}

	public async search(query: string): Promise<ExerciseSearchResult[]> {
		// The catalog is synchronized by the caller when it is opened. Searching
		// must only read the local catalog; otherwise every keystroke could make a
		// request to the API through syncCatalog().
		// If the screen is still loading that catalog, wait for the same in-flight
		// synchronization instead of indexing an older (or empty) IDB snapshot.
		if (this.syncPromise) await this.syncPromise;
		if (!this.isIndexReady) {
			const catalog =
				await indexedDbService.search<ExerciseParameter>(EXERCISES_STORE);
			await this.rebuildIndex(catalog);
		}
		const term = query.trim();

		if (!term) {
			return (
				await indexedDbService.search<ExerciseParameter>(EXERCISES_STORE)
			).map((exercise) => ({ ...exercise, scorePonderado: 0 }));
		}

		const limit = Math.max(this.catalogSize, 1);
		const [stemmedResults, typoTolerantResults] = await Promise.all([
			search(this.stemmedIndex, {
				term: term
					.trim()
					.split(/\s+/)
					.filter((t) => t.length > 3)
					.map(removeCommonSuffix)
					.join(' '),
				properties: ['name', 'description'],
				boost: { name: 2, description: 1 },
				limit,
				relevance: {
					// k: 1.2,
					b: 0,
					// d: 0.5,
				},
			}),
			search(this.typoTolerantIndex, {
				term,
				properties: ['name', 'description'],
				boost: { name: 2, description: 1 },
				tolerance: 2,
				limit,
				relevance: {
					// k: 1.2,
					b: 0,
					// d: 0.5,
				},
			}),
		]);
		const weightedResults = [
			...stemmedResults.hits.map((hit) => ({
				...hit,
				score: hit.score * STEMMED_SEARCH_WEIGHT,
			})),
			...typoTolerantResults.hits.map((hit) => ({
				...hit,
				score: hit.score * TYPO_TOLERANT_SEARCH_WEIGHT,
			})),
		];
		const results = new Map<string, (typeof weightedResults)[number]>();
		weightedResults.forEach((result) => {
			const current = results.get(result.id);
			results.set(result.id, {
				...result,
				score: (current?.score ?? 0) + result.score,
			});
		});
		return Array.from(results.values())
			.sort((left, right) => right.score - left.score)
			.map((result) => ({
				id: result.id,
				name: result.document.name,
				description: result.document.description,
				metric1Id: result.document.metric1Id,
				metric2Id: result.document.metric2Id || null,
				visualUrl: result.document.visualUrl || null,
				scorePonderado: result.score,
			}));
	}

	public async create(dto: CreateExerciseInput) {
		return authenticatedRequest<ExerciseParameter>('exercises', {
			method: 'POST',
			body: JSON.stringify(dto),
		});
	}

	private async rebuildIndex(items: ExerciseParameter[]): Promise<void> {
		this.stemmedIndex = createStemmedCatalogIndex();
		this.typoTolerantIndex = createTypoTolerantCatalogIndex();
		this.catalogSize = items.length;
		const documents = items.map((item) => ({
			id: item.id,
			name: item.name,
			description: item.description ?? '',
			metric1Id: item.metric1Id,
			metric2Id: item.metric2Id ?? 0,
			visualUrl: item.visualUrl ?? '',
		}));

		if (documents.length > 0) {
			await Promise.all([
				insertMultiple(this.stemmedIndex, documents),
				insertMultiple(this.typoTolerantIndex, documents),
			]);
		}
		this.isIndexReady = true;
	}
}

export const exercisesService = new ExercisesService();
