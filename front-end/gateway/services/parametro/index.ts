export type ParameterEntity = {
	id: string;
	name: string;
	description?: string;
};

import {
	CACHE_PARAMETROS as CACHE_PARAMETERS,
	TTL_PARAMETROS as TTL_PARAMETERS,
} from '../../../lib/constants';
import { IndexedDbEntity, indexedDbService } from '../../../lib/indexeddb';
import { ExerciseParameter, exercisesService } from './exercises';
import { MetricsService } from './metrics';

export type ParameterType = 'metrics' | 'exercises';

export class ParametersService {
	public async search<T extends IndexedDbEntity>(
		parameter: ParameterType,
	): Promise<T[]> {
		if (parameter === 'exercises') {
			return exercisesService
				.syncCatalog()
				.then((items) => items as unknown as T[]);
		}

		const cachedResults = CACHE_PARAMETERS
			? await indexedDbService.search(parameter)
			: null;
		const lastSearchKey = `last_search_${parameter}`;
		const lastSearch =
			typeof localStorage !== 'undefined'
				? Number(localStorage.getItem(lastSearchKey))
				: NaN;
		const cacheIsValid =
			Number.isFinite(lastSearch) && Date.now() - lastSearch < TTL_PARAMETERS;

		if (cacheIsValid && cachedResults?.length) return cachedResults as T[];

		const searchResult = await this.webSearch<T>(parameter, lastSearchKey);
		await indexedDbService.anexar<T>(parameter, searchResult);
		if (typeof localStorage !== 'undefined') {
			localStorage.setItem(lastSearchKey, String(Date.now()));
		}

		return searchResult as T[];
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

export * from '../../../lib/indexeddb';
export * from './metrics';
export * from './exercises';
export * from '../../../lib/constants';
