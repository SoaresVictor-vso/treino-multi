import type { FulltextSearch } from './fulltext-search';
import { MiniSearchFulltextSearch } from './mini-search';
import type { SearchOptions } from 'minisearch';

export type { FulltextSearch } from './fulltext-search';

// Ponto único de troca do mecanismo de busca usado pelo frontend.
export const createFulltextSearch = <T extends { id: string }>(config: {
	fields: Array<keyof T & string>;
	storeFields: Array<keyof T & string>;
	searchOptions?: SearchOptions;
	normalize?: (value: string) => string;
}): FulltextSearch<T> => new MiniSearchFulltextSearch<T>(config);
