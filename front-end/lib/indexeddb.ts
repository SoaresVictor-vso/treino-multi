export type IndexedDbEntity = {
	id: string;
	[key: string]: unknown;
};

const DATABASE_NAME = 'treino-multi';

export class IndexedDbService {
	public async search<T extends IndexedDbEntity>(
		parametro: string,
		filtros: Partial<Record<keyof T, unknown>> = {},
	): Promise<T[]> {
		if (typeof window === 'undefined' || !window.indexedDB) return [];

		const database = await this.openDatabase(parametro);

		return new Promise((resolve, reject) => {
			const request = database
				.transaction(parametro, 'readonly')
				.objectStore(parametro)
				.getAll();
			request.onsuccess = () => {
				const entities = request.result as T[];
				const entries = Object.entries(filtros) as [keyof T, unknown][];

				const results =
					entities.filter((entity) =>
						entries.every(([campo, valor]) => entity[campo] === valor),
					);
				database.close();
				resolve(results);
			};
			request.onerror = () => {
				database.close();
				reject(request.error);
			};
		});
	}

	public async anexar<T extends IndexedDbEntity>(
		parametro: string,
		entities: T[],
	): Promise<void> {
		if (
			typeof window === 'undefined' ||
			!window.indexedDB ||
			entities.length === 0
		)
			return;

		const fields = [
			...new Set(entities.flatMap((entity) => Object.keys(entity))),
		];
		const database = await this.openDatabase(parametro, fields);

		return new Promise((resolve, reject) => {
			const transaction = database.transaction(parametro, 'readwrite');
			const store = transaction.objectStore(parametro);

			entities.forEach((entity) => store.put(entity));

			transaction.oncomplete = () => {
				database.close();
				resolve();
			};
			transaction.onerror = () => {
				database.close();
				reject(transaction.error);
			};
			transaction.onabort = () => {
				database.close();
				reject(transaction.error);
			};
		});
	}

	public async remover(parametro: string, ids: string[]): Promise<void> {
		if (typeof window === 'undefined' || !window.indexedDB || ids.length === 0)
			return;

		const database = await this.openDatabase(parametro);

		return new Promise((resolve, reject) => {
			const transaction = database.transaction(parametro, 'readwrite');
			const store = transaction.objectStore(parametro);

			ids.forEach((id) => store.delete(id));

			transaction.oncomplete = () => {
				database.close();
				resolve();
			};
			transaction.onerror = () => {
				database.close();
				reject(transaction.error);
			};
			transaction.onabort = () => {
				database.close();
				reject(transaction.error);
			};
		});
	}

	private openDatabase(
		parametro: string,
		fields: string[] = [],
	): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DATABASE_NAME);

			request.onupgradeneeded = () => {
				this.configureObjectStore(
					request.result,
					parametro,
					fields,
					request.transaction,
				);
			};
			request.onsuccess = () => {
				const database = request.result;
				database.onversionchange = () => database.close();

				if (!database.objectStoreNames.contains(parametro)) {
					const nextVersion = database.version + 1;
					database.close();
					const upgradeRequest = indexedDB.open(DATABASE_NAME, nextVersion);

					upgradeRequest.onupgradeneeded = () => {
						this.configureObjectStore(
							upgradeRequest.result,
							parametro,
							fields,
							upgradeRequest.transaction,
						);
					};
					upgradeRequest.onsuccess = () => {
						const upgradedDatabase = upgradeRequest.result;
						upgradedDatabase.onversionchange = () => upgradedDatabase.close();
						resolve(upgradedDatabase);
					};
					upgradeRequest.onerror = () => reject(upgradeRequest.error);
					return;
				}

				const store = database
					.transaction(parametro, 'readonly')
					.objectStore(parametro);
				const missingFields = fields.filter(
					(field) => field !== 'id' && !store.indexNames.contains(field),
				);

				if (missingFields.length === 0) {
					resolve(database);
					return;
				}

				const nextVersion = database.version + 1;
				database.close();
				const upgradeRequest = indexedDB.open(DATABASE_NAME, nextVersion);

				upgradeRequest.onupgradeneeded = () => {
					this.configureObjectStore(
						upgradeRequest.result,
						parametro,
						fields,
						upgradeRequest.transaction,
					);
				};
				upgradeRequest.onsuccess = () => {
					const upgradedDatabase = upgradeRequest.result;
					upgradedDatabase.onversionchange = () => upgradedDatabase.close();
					resolve(upgradedDatabase);
				};
				upgradeRequest.onerror = () => reject(upgradeRequest.error);
			};
			request.onerror = () => reject(request.error);
		});
	}

	private configureObjectStore(
		database: IDBDatabase,
		parametro: string,
		fields: string[],
		upgradeTransaction?: IDBTransaction | null,
	): void {
		const store = database.objectStoreNames.contains(parametro)
			? (upgradeTransaction?.objectStore(parametro) ??
				database.transaction(parametro, 'readwrite').objectStore(parametro))
			: database.createObjectStore(parametro, { keyPath: 'id' });

		fields
			.filter((field) => field !== 'id' && !store.indexNames.contains(field))
			.forEach((field) => store.createIndex(field, field, { unique: false }));
	}
}

export const indexedDbService = new IndexedDbService();
