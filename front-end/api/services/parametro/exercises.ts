import { authenticatedRequest } from "@/api/client";
import { indexedDbService, type IndexedDbEntity } from "@/lib/indexeddb";
import MiniSearch from "minisearch";

export type ExerciseParameter = IndexedDbEntity & {
  id: string;
  name: string;
  description: string;
};

type ExerciseSyncResponse = {
  exercises: Array<{
    id: number;
    name: string;
    description?: string | null;
  }>;
  deletedIds: number[];
  syncedAt: string;
};

type ExerciseSearchDocument = {
  id: string;
  name: string;
  description: string;
};

export interface ExercisesServiceContract {
  buscar(since: string | null): Promise<ExerciseSyncResponse>;
  syncCatalog(): Promise<ExerciseParameter[]>;
  search(query: string): Promise<ExerciseParameter[]>;
}

const EXERCISES_STORE = "exercises";
const EXERCISES_SYNC_CURSOR_KEY = "last_sync_exercises";

export class ExercisesService implements ExercisesServiceContract {
  private readonly index = new MiniSearch<ExerciseSearchDocument>({
    fields: ["name", "description"],
    storeFields: ["id", "name", "description"],
    searchOptions: {
      prefix: true,
      fuzzy: 0.2,
      boost: { name: 4, description: 1 },
    },
    processTerm: (term) => this.normalize(term),
  });

  private documents: ExerciseSearchDocument[] = [];

  public async buscar(since: string | null): Promise<ExerciseSyncResponse> {
    const endpoint = since
      ? `exercises/sync?since=${encodeURIComponent(since)}`
      : "exercises/sync";

    const response = await authenticatedRequest<ExerciseSyncResponse>(endpoint);
    if (!response.success || !response.data) {
      return { exercises: [], deletedIds: [], syncedAt: since ?? new Date(0).toISOString() };
    }

    return response.data;
  }

  public async syncCatalog(): Promise<ExerciseParameter[]> {
    const since = typeof localStorage !== "undefined"
      ? localStorage.getItem(EXERCISES_SYNC_CURSOR_KEY)
      : null;
    const { exercises, deletedIds, syncedAt } = await this.buscar(since);

    const normalized = exercises.map((exercise) => ({
      id: String(exercise.id),
      name: exercise.name,
      description: exercise.description ?? "",
    }));

    if (normalized.length > 0) {
      await indexedDbService.anexar<ExerciseParameter>(EXERCISES_STORE, normalized);
    }

    const toDelete = deletedIds.map((id) => String(id));
    if (toDelete.length > 0) {
      await indexedDbService.remover(EXERCISES_STORE, toDelete);
    }

    if (typeof localStorage !== "undefined" && syncedAt) {
      localStorage.setItem(EXERCISES_SYNC_CURSOR_KEY, syncedAt);
    }

    const exercisesCache = await indexedDbService.buscar<ExerciseParameter>(EXERCISES_STORE);
    this.rebuildIndex(exercisesCache);
    return exercisesCache;
  }

  public async search(query: string): Promise<ExerciseParameter[]> {
    const catalog = await this.syncCatalog();
    const normalizedQuery = query.trim();

    if (!normalizedQuery) return catalog;

    return this.index
      .search(this.normalize(normalizedQuery), {
        prefix: true,
        fuzzy: 0.2,
        boost: { name: 4, description: 1 },
      })
      .map((result) => ({
        id: result.id,
        name: result.name,
        description: result.description,
      }));
  }

  private rebuildIndex(items: ExerciseParameter[]): void {
    this.documents = items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
    }));

    this.index.removeAll();
    if (this.documents.length > 0) {
      this.index.addAll(this.documents);
    }
  }

  private normalize(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  }
}

export const exercisesService = new ExercisesService();
