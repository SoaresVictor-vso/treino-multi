export type ParameterEntity = {
	id: string;
	name: string;
	description?: string;
};

import {
	CACHE_PARAMETROS as CACHE_PARAMETERS,
	TTL_PARAMETROS as TTL_PARAMETERS,
} from '../../../lib/constants';
import { IndexedDbEntity } from '../../../lib/indexeddb';
import { clearCatalogRows, readCatalogRows } from '@/lib/offline-catalog';
import { ExerciseParameter, exercisesService } from './exercises';
import { MetricsService } from './metrics';

export type ParameterType = 'metrics' | 'exercises';

export async function clearParametersCache(): Promise<void> {
	await exercisesService.waitForSync();
	await clearCatalogRows();
	localStorage.removeItem('last_sync_exercises');
	localStorage.removeItem('last_search_exercises');
	localStorage.removeItem('last_search_metrics');
	exercisesService.resetSearchIndex();
}

export class ParametersService {
	public async search<T extends IndexedDbEntity>(
		parameter: ParameterType,
	): Promise<T[]> {
		if (parameter === 'exercises') {
			return readCatalogRows(parameter);
		}

		const cachedResults = CACHE_PARAMETERS
			? await readCatalogRows(parameter)
			: null;
		const lastSearchKey = `last_search_${parameter}`;
		const lastSearch =
			typeof localStorage !== 'undefined'
				? Number(localStorage.getItem(lastSearchKey))
				: NaN;
		const cacheIsValid =
			Number.isFinite(lastSearch) && Date.now() - lastSearch < TTL_PARAMETERS;

		if (cacheIsValid && cachedResults?.length) return cachedResults as T[];

		return (cachedResults ?? []) as T[];
	}

	public async fullTextSearchExercises(
		query: string,
	): Promise<ExerciseParameter[]> {
		return exercisesService.search(query);
	}

	private webSearch<T>(
		parameter: ParameterType,
		lastSync: string | null = null,
	): Promise<T[]> {
		switch (parameter) {
			case 'metrics':
				return new MetricsService().search() as Promise<T[]>;
			case 'exercises':
				return exercisesService
					.syncCatalog()
					.then((items) => items as unknown as T[]);
			default:
				console.log(lastSync, parameter);
				throw new Error(`Parâmetro desconhecido: ${parameter}`);
		}
	}
}

export * from './metrics';
export * from './exercises';
export * from '../../../lib/constants';
