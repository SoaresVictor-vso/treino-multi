import MiniSearch, { type SearchOptions } from 'minisearch';
import type { FulltextSearch } from './fulltext-search';

type MiniSearchConfig<T extends { id: string }> = {
	fields: Array<keyof T & string>;
	storeFields: Array<keyof T & string>;
	searchOptions?: SearchOptions;
	normalize?: (value: string) => string;
};

export class MiniSearchFulltextSearch<
	T extends { id: string },
> implements FulltextSearch<T> {
	private readonly index: MiniSearch<T>;

	public constructor(config: MiniSearchConfig<T>) {
		this.index = new MiniSearch<T>({
			fields: config.fields,
			storeFields: config.storeFields,
			searchOptions: config.searchOptions,
			processTerm: config.normalize,
		});
	}

	public addAll(documents: T[]): void {
		this.index.addAll(documents);
	}

	public removeAll(): void {
		this.index.removeAll();
	}

	public search(query: string): T[] {
		return this.index.search(query) as unknown as T[];
	}
}
