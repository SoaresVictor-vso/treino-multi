export interface FulltextSearch<T extends { id: string }> {
	addAll(documents: T[]): void;
	removeAll(): void;
	search(query: string): T[];
}
