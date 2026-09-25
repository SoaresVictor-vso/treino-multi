import type { CreateMyWorkoutDto, TrainerWorkout, WorkoutDetail, WorkoutExecution } from '@/gateway/services/workouts';
import { authenticatedRequest, waitForAccountCacheReset } from '@/gateway/client';
import { readCatalogRows } from '@/lib/offline-catalog';
import type { ExerciseParameter, Metric } from '@/gateway/services/parametro';
import { exercisesService, metricsService } from '@/gateway/services/parametro';
import { tools as sharedTools } from '@treino-multi/shared';
type CachedMetric = Omit<Metric, 'id'> & { id: string };

// This database deliberately has a fixed schema. A workout and its executions are
// stored as one value, so no reader can observe only half of an edit.
const DB_NAME = 'treino-multi-contingency';
const DB_VERSION = 2;
const CONFIRMED = 'confirmed';
const PENDING = 'pending';
const META = 'meta';
const STAGING = 'staging';

export type LocalWorkout = {
  id: string;
  userId: string;
  workout: WorkoutDetail;
  synchronized: boolean;
  revision: number;
  operationId: string;
  conflict?: WorkoutDetail;
  resolution?: 'force' | 'copy';
  inflight?: { operationId: string; revision: number; workout: WorkoutDetail; resolution?: 'force' | 'copy' };
  savedAt: string;
};

function key(userId: string, workoutId: string): string {
  return `${userId}:${workoutId}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB indisponível.'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CONFIRMED)) db.createObjectStore(CONFIRMED, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(PENDING)) db.createObjectStore(PENDING, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(META)) db.createObjectStore(META, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(STAGING)) db.createObjectStore(STAGING, { keyPath: 'id' });
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
    request.onerror = () => reject(request.error);
  });
}

async function read(storeName: string, userId: string, workoutId: string): Promise<LocalWorkout | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, 'readonly');
    const request = transaction.objectStore(storeName).get(key(userId, workoutId));
    request.onsuccess = () => resolve((request.result as LocalWorkout | undefined) ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

export const readConfirmedWorkout = (userId: string, workoutId: string) => read(CONFIRMED, userId, workoutId);
export const readPendingWorkout = (userId: string, workoutId: string) => read(PENDING, userId, workoutId);

function deriveWorkout(workout: WorkoutDetail): WorkoutDetail {
  return { ...workout, executions: workout.executions.map((row) => ({ ...row,
    predictedRm: sharedTools.predictedRmForExecution({ completed: row.status === 'completed',
      metric1Name: row.exercise.metric_1.name, metric2Name: row.exercise.metric_2?.name,
      metric1: row.performedMetric1, metric2: row.performedMetric2 }),
  })) };
}

export async function readCurrentWorkout(userId: string, workoutId: string): Promise<LocalWorkout | null> {
  const row = (await readPendingWorkout(userId, workoutId)) ?? await readConfirmedWorkout(userId, workoutId);
  return row ? { ...row, workout: deriveWorkout(row.workout) } : null;
}

export async function readPendingWorkouts(userId: string): Promise<LocalWorkout[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING, 'readonly');
    const request = transaction.objectStore(PENDING).getAll();
    request.onsuccess = () => resolve((request.result as LocalWorkout[]).filter((row) => row.userId === userId));
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onabort = () => { db.close(); reject(transaction.error); };
  });
}

export async function createConfirmedWorkout(userId: string, workout: WorkoutDetail): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(CONFIRMED, 'readwrite');
    const id = key(userId, workout.id);
    // A pull may update the server snapshot, but it must never remove a local edit.
    transaction.objectStore(CONFIRMED).put({ id, userId, workout, synchronized: true, revision: 0, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

const pendingWrites = new Map<string, Promise<LocalWorkout>>();

export function updatePendingWorkout(userId: string, workout: WorkoutDetail): Promise<LocalWorkout> {
  const id = key(userId, workout.id);
  const previous = pendingWrites.get(id);
  const write = (previous ? previous.catch(() => undefined) : Promise.resolve()).then(() => writePendingWorkout(userId, workout));
  pendingWrites.set(id, write);
  void write.finally(() => { if (pendingWrites.get(id) === write) pendingWrites.delete(id); }).catch(() => undefined);
  return write;
}

export async function waitForPendingWorkoutWrites(userId: string, workoutId: string): Promise<void> {
  await pendingWrites.get(key(userId, workoutId));
}

async function writePendingWorkout(userId: string, workout: WorkoutDetail): Promise<LocalWorkout> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(PENDING, 'readwrite');
    const store = transaction.objectStore(PENDING);
    const id = key(userId, workout.id);
    const request = store.get(id);
    let saved: LocalWorkout;
    request.onsuccess = () => {
      const previous = request.result as LocalWorkout | undefined;
      saved = { id, userId, workout, synchronized: false, revision: (previous?.revision ?? 0) + 1, operationId: crypto.randomUUID(), conflict: previous?.conflict, resolution: previous?.resolution, inflight: previous?.inflight, savedAt: new Date().toISOString() };
      store.put(saved);
    };
    transaction.oncomplete = () => { db.close(); resolve(saved); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

export async function confirmPendingWorkout(userId: string, workout: WorkoutDetail, revision: number, sent?: WorkoutDetail): Promise<boolean> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([CONFIRMED, PENDING], 'readwrite');
    const id = key(userId, workout.id);
    const pendingStore = transaction.objectStore(PENDING);
    const request = pendingStore.get(id);
    let cleared = false;
    request.onsuccess = () => {
      const current = request.result as LocalWorkout | undefined;
      transaction.objectStore(CONFIRMED).put({ id, userId, workout, synchronized: true, revision, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
      if (current?.revision === revision) {
        pendingStore.delete(id);
        cleared = true;
      } else if (current) {
        const assigned = new Map<number, number>();
        for (const item of sent?.executions ?? []) {
          if (item.id >= 0) continue;
          const saved = workout.executions.find((candidate) => candidate.position === item.position && candidate.exerciseId === item.exerciseId);
          if (saved) assigned.set(item.id, saved.id);
        }
        pendingStore.put({ ...current, inflight: undefined, workout: {
          ...current.workout,
          syncRevision: workout.syncRevision,
          executions: current.workout.executions.map((item) => item.id > 0 ? item : {
            ...item, id: assigned.get(item.id) ?? item.id,
          }),
        } });
      }
    };
    transaction.oncomplete = () => { db.close(); resolve(cleared); };
    transaction.onabort = () => { db.close(); reject(transaction.error); };
    transaction.onerror = () => { db.close(); reject(transaction.error); };
  });
}

async function confirmCopiedWorkout(userId: string, originalId: string, workout: WorkoutDetail, revision: number, sent: WorkoutDetail): Promise<boolean> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, PENDING], 'readwrite');
    const pending = tx.objectStore(PENDING);
    const request = pending.get(key(userId, originalId));
    let cleared = false;
    request.onsuccess = () => {
      tx.objectStore(CONFIRMED).put({ id: key(userId, workout.id), userId, workout, synchronized: true, revision, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
      const row = request.result as LocalWorkout | undefined;
      if (row?.revision === revision) { pending.delete(row.id); cleared = true; }
      else if (row) {
        const assigned = new Map<number, number>();
        for (const item of sent.executions) {
          const saved = workout.executions.find((candidate) => candidate.position === item.position && candidate.exerciseId === item.exerciseId);
          if (saved) assigned.set(item.id, saved.id);
        }
        pending.delete(row.id);
        pending.put({ ...row, id: key(userId, workout.id), inflight: undefined,
          operationId: crypto.randomUUID(), resolution: undefined,
          workout: { ...row.workout, id: workout.id, syncRevision: workout.syncRevision,
            createdBy: userId, origin: 'athlete',
            executions: row.workout.executions.map((item) => ({ ...item, id: assigned.get(item.id) ?? item.id })),
          } });
      }
    };
    tx.oncomplete = () => { db.close(); resolve(cleared); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

type PullResponse = {
  full: boolean;
  workouts: WorkoutDetail[];
  deletedIds: string[];
  cursor: string;
};

function metaId(userId: string) { return `${userId}:workouts`; }
function trainerReviewId(userId: string, workoutId: string) { return `${userId}:${workoutId}:trainer-review`; }

function prescriptionChanged(a: WorkoutExecution, b: WorkoutExecution): boolean {
  return ['prescribedMetric1', 'prescribedMetric2', 'prescribedPse', 'prescribedRestDuration', 'setType']
    .some((field) => a[field as keyof WorkoutExecution] !== b[field as keyof WorkoutExecution]);
}

function contingencyCopy(row: WorkoutExecution, position: number): WorkoutExecution {
  return { ...row, id: -Math.abs(position), position, setType: 'contingencia_offline', status: 'skipped',
    performedMetric1: null, performedMetric2: null, performedPse: null, performedRestDuration: null,
    performedNote: null, startedAt: null, finishedAt: null, adherenceSnapshot: null };
}

export async function readTrainerReview(userId: string, workoutId: string): Promise<WorkoutExecution[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const request = tx.objectStore(META).get(trainerReviewId(userId, workoutId));
    request.onsuccess = () => resolve((request.result as { executions?: WorkoutExecution[] } | undefined)?.executions ?? []);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function acknowledgeTrainerReview(userId: string, workoutId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).delete(trainerReviewId(userId, workoutId));
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function withTrainerContingencies(userId: string, workout: WorkoutDetail): Promise<WorkoutDetail> {
  const changed = await readTrainerReview(userId, workout.id);
  if (!changed.length) return workout;
  const existing = new Set(workout.executions.filter((row) => row.setType === 'contingencia_offline').map((row) => row.exerciseId));
  const additional = changed.filter((row) => !existing.has(row.exerciseId));
  let position = Math.max(0, ...workout.executions.map((row) => row.position));
  return { ...workout, executions: [...workout.executions, ...additional.map((row) => contingencyCopy(row, ++position))] };
}

async function reconcileTrainerConflict(userId: string, row: LocalWorkout, server: WorkoutDetail): Promise<void> {
  const localById = new Map(row.workout.executions.map((item) => [item.id, item]));
  const changed = server.executions.filter((item) => {
    const local = localById.get(item.id);
    return local?.status === 'completed' && prescriptionChanged(local, item);
  });
  const merged: WorkoutDetail = { ...server, status: row.workout.status, performedAt: row.workout.performedAt,
    finishedAt: row.workout.finishedAt, executions: server.executions.map((item) => {
      const local = localById.get(item.id);
      return local?.status === 'completed' ? { ...item,
        performedMetric1: local.performedMetric1, performedMetric2: local.performedMetric2,
        performedPse: local.performedPse, performedRestDuration: local.performedRestDuration,
        performedNote: local.performedNote, status: 'completed' as const,
        startedAt: local.startedAt, finishedAt: local.finishedAt,
        adherenceSnapshot: prescriptionChanged(local, item) ? {
          prescribedMetric1: local.prescribedMetric1, prescribedMetric2: local.prescribedMetric2,
          prescribedPse: local.prescribedPse, prescribedRestDuration: local.prescribedRestDuration,
        } : local.adherenceSnapshot,
      } : row.workout.status === 'completed' ? { ...item, status: 'skipped' as const } : item;
    }) };
  const reviewed = row.workout.status === 'completed' ? {
    ...merged, executions: [...merged.executions, ...changed.map((item, index) => contingencyCopy(item, merged.executions.length + index + 1))],
  } : merged;
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, PENDING, META], 'readwrite');
    const request = tx.objectStore(PENDING).get(row.id);
    request.onsuccess = () => {
      const latest = request.result as LocalWorkout | undefined;
      if (!latest || latest.revision !== row.revision) { tx.abort(); return; }
      tx.objectStore(CONFIRMED).put({ id: row.id, userId, workout: server, synchronized: true, revision: 0, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
      tx.objectStore(PENDING).put({ ...latest, workout: reviewed, revision: latest.revision + 1, operationId: crypto.randomUUID(), conflict: undefined, inflight: undefined, savedAt: new Date().toISOString() });
      if (changed.length) {
        const meta = tx.objectStore(META);
        const review = meta.get(trainerReviewId(userId, row.workout.id));
        review.onsuccess = () => {
          const prior = (review.result as { executions?: WorkoutExecution[] } | undefined)?.executions ?? [];
          const byId = new Map([...prior, ...changed].map((item) => [item.id, item]));
          meta.put({ id: trainerReviewId(userId, row.workout.id), executions: [...byId.values()] });
        };
      }
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Treino alterado enquanto era conciliado.')); };
  });
}

export async function readWorkoutCursor(userId: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const request = tx.objectStore(META).get(metaId(userId));
    request.onsuccess = () => resolve((request.result as { cursor?: string } | undefined)?.cursor ?? null);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function readConfirmedWorkouts(userId: string): Promise<WorkoutDetail[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(CONFIRMED, 'readonly');
    const request = tx.objectStore(CONFIRMED).getAll();
    request.onsuccess = () => resolve((request.result as LocalWorkout[]).filter((row) => row.userId === userId).map((row) => deriveWorkout(row.workout)));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function readVisibleWorkouts(userId: string): Promise<WorkoutDetail[]> {
  const [confirmed, pending] = await Promise.all([
    readConfirmedWorkouts(userId), readPendingWorkouts(userId),
  ]);
  const byId = new Map(confirmed.map((workout) => [workout.id, workout]));
  for (const row of pending) byId.set(row.workout.id, deriveWorkout(row.workout));
  return [...byId.values()];
}

const analysisSourcePromises = new Map<string, Promise<void>>();

export function syncAnalysisSource(userId: string, athleteId: string): Promise<void> {
  const id = `${userId}:${athleteId}`;
  const existing = analysisSourcePromises.get(id);
  if (existing) return existing;
  const task = syncAnalysisSourceOnce(userId, athleteId);
  analysisSourcePromises.set(id, task);
  void task.finally(() => { if (analysisSourcePromises.get(id) === task) analysisSourcePromises.delete(id); }).catch(() => undefined);
  return task;
}

async function syncAnalysisSourceOnce(userId: string, athleteId: string): Promise<void> {
  if (userId === athleteId) return;
  const list = await authenticatedRequest<{ athlete: { name: string }; workouts: { id: string }[] }>(`workouts/athletes/${athleteId}`);
  if (!list.success || !list.data) throw new Error(list.error || 'Falha ao buscar os treinos do atleta.');
  const details = await Promise.all(list.data.workouts.map(({ id }) => authenticatedRequest<WorkoutDetail>(`workouts/${id}`)));
  const workouts = details.map((response) => {
    if (!response.success || !response.data) throw new Error(response.error || 'Falha ao buscar o treino.');
    if (response.data.athleteId !== athleteId) throw new Error('Treino de outro atleta na resposta.');
    return response.data;
  });
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, META], 'readwrite');
    const store = tx.objectStore(CONFIRMED);
    const request = store.getAll();
    request.onsuccess = () => {
      for (const row of request.result as LocalWorkout[]) {
        if (row.userId === userId && row.workout.athleteId === athleteId) store.delete(row.id);
      }
      for (const workout of workouts) store.put({ id: key(userId, workout.id), userId, workout, synchronized: true, revision: 0, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
      tx.objectStore(META).put({ id: `${userId}:${athleteId}:name`, name: list.data!.athlete.name });
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function readAthleteSourceName(userId: string, athleteId: string): Promise<string | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const request = tx.objectStore(META).get(`${userId}:${athleteId}:name`);
    request.onsuccess = () => resolve((request.result as { name?: string } | undefined)?.name ?? null);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function syncSingleWorkoutSource(userId: string, workoutId: string): Promise<void> {
  const response = await authenticatedRequest<WorkoutDetail>(`workouts/${workoutId}`);
  if (!response.success || !response.data) throw new Error(response.error || 'Falha ao buscar o treino.');
  await createConfirmedWorkout(userId, response.data);
}

const trainerListPromises = new Map<string, Promise<void>>();

export function syncTrainerWorkoutList(userId: string): Promise<void> {
  const existing = trainerListPromises.get(userId);
  if (existing) return existing;
  const task = syncTrainerWorkoutListOnce(userId);
  trainerListPromises.set(userId, task);
  void task.finally(() => { if (trainerListPromises.get(userId) === task) trainerListPromises.delete(userId); }).catch(() => undefined);
  return task;
}

async function syncTrainerWorkoutListOnce(userId: string): Promise<void> {
  await waitForAccountCacheReset();
  const response = await authenticatedRequest<TrainerWorkout[]>('workouts/trainer');
  if (!response.success || !response.data) throw new Error(response.error || 'Falha ao buscar os treinos.');
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    tx.objectStore(META).put({ id: `${userId}:trainer-workouts`, workouts: response.data });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function readTrainerWorkoutList(userId: string): Promise<TrainerWorkout[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readonly');
    const request = tx.objectStore(META).get(`${userId}:trainer-workouts`);
    request.onsuccess = () => resolve((request.result as { workouts?: TrainerWorkout[] } | undefined)?.workouts ?? []);
    tx.oncomplete = () => db.close();
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function clearOfflineUserData(userId: string): Promise<void> {
  await Promise.all([
    syncPromises.get(userId), generalSyncPromises.get(userId), pullPromises.get(userId), trainerListPromises.get(userId),
    ...[...analysisSourcePromises.entries()].filter(([id]) => id.startsWith(`${userId}:`)).map(([, task]) => task),
  ].filter(Boolean).map((task) => task!.catch(() => undefined)));
  await Promise.all([...pendingWrites.entries()].filter(([id]) => id.startsWith(`${userId}:`)).map(([, task]) => task));
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, PENDING, META, STAGING], 'readwrite');
    for (const name of [CONFIRMED, PENDING, STAGING]) {
      const store = tx.objectStore(name);
      const request = store.getAll();
      request.onsuccess = () => {
        for (const row of request.result as LocalWorkout[]) if (row.userId === userId) store.delete(row.id);
      };
    }
    const metadata = tx.objectStore(META);
    const metaRequest = metadata.getAll();
    metaRequest.onsuccess = () => {
      for (const row of metaRequest.result as { id: string }[]) if (row.id.startsWith(`${userId}:`)) metadata.delete(row.id);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

export async function discardPendingWorkouts(userId: string): Promise<void> {
  await Promise.all([syncPromises.get(userId), generalSyncPromises.get(userId)].filter(Boolean).map((task) => task!.catch(() => undefined)));
  await Promise.all([...pendingWrites.entries()].filter(([id]) => id.startsWith(`${userId}:`)).map(([, task]) => task));
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING, 'readwrite');
    const store = tx.objectStore(PENDING);
    const request = store.getAll();
    request.onsuccess = () => {
      for (const row of request.result as LocalWorkout[]) if (row.userId === userId) store.delete(row.id);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function clearTrainerReviews(userId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(META, 'readwrite');
    const store = tx.objectStore(META);
    const request = store.getAll();
    request.onsuccess = () => {
      for (const row of request.result as { id: string }[]) if (row.id.startsWith(`${userId}:`) && row.id.endsWith(':trainer-review')) store.delete(row.id);
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function recordWorkoutConflict(userId: string, workoutId: string, currentState: WorkoutDetail): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING, 'readwrite');
    const store = tx.objectStore(PENDING);
    const request = store.get(key(userId, workoutId));
    request.onsuccess = () => {
      const row = request.result as LocalWorkout | undefined;
      if (row) store.put({ ...row, conflict: currentState, resolution: undefined, inflight: undefined });
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function preparePendingSubmission(row: LocalWorkout): Promise<LocalWorkout | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PENDING, 'readwrite');
    const store = tx.objectStore(PENDING);
    const request = store.get(row.id);
    let submission: LocalWorkout | null = null;
    request.onsuccess = () => {
      const current = request.result as LocalWorkout | undefined;
      if (!current) return;
      const inflight = current.inflight ?? {
        operationId: current.operationId || crypto.randomUUID(),
        revision: current.revision,
        workout: current.workout,
        resolution: current.resolution,
      };
      if (!current.inflight) store.put({ ...current, operationId: inflight.operationId, inflight });
      submission = { ...current, operationId: inflight.operationId, revision: inflight.revision,
        workout: inflight.workout, resolution: inflight.resolution };
    };
    tx.oncomplete = () => { db.close(); resolve(submission); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export async function resolveWorkoutConflict(userId: string, workoutId: string, choice: 'current' | 'saved' | 'both'): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, PENDING], 'readwrite');
    const pending = tx.objectStore(PENDING);
    const request = pending.get(key(userId, workoutId));
    request.onsuccess = () => {
      const row = request.result as LocalWorkout | undefined;
      if (!row?.conflict) { tx.abort(); return; }
      const server = row.conflict;
      tx.objectStore(CONFIRMED).put({ id: key(userId, workoutId), userId, workout: server, synchronized: true, revision: 0, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
      if (choice === 'current') pending.delete(row.id);
      else pending.put({ ...row, conflict: undefined, resolution: choice === 'both' ? 'copy' : 'force', operationId: crypto.randomUUID(), inflight: undefined, workout: { ...row.workout, syncRevision: server.syncRevision } });
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Conflito indisponível.')); };
  });
}

export async function warmTrainerCache(): Promise<void> {
  await waitForAccountCacheReset();
  await Promise.all([
    metricsService.sync(),
    exercisesService.syncCatalog(),
  ]);
}

export async function createLocalWorkout(userId: string, userName: string | null, input: CreateMyWorkoutDto): Promise<WorkoutDetail> {
  const activities = input.activities ?? [];
  const [exercises, metrics] = await Promise.all([
    readCatalogRows<ExerciseParameter>('exercises'),
    readCatalogRows<CachedMetric>('metrics'),
  ]);
  const exercisesById = new Map(exercises.map((exercise) => [Number(exercise.id), exercise]));
  const metricsById = new Map(metrics.map((metric) => [Number(metric.id), metric]));
  const startedAt = input.performedAt ?? (input.startImmediately ? new Date().toISOString() : null);
  const finishedAt = input.recordAsCompleted && startedAt
    ? new Date(new Date(startedAt).getTime() + (input.durationSeconds ?? 1) * 1000).toISOString()
    : null;
  const executions: WorkoutExecution[] = activities.map((activity, index) => {
    const exercise = exercisesById.get(activity.exerciseId);
    const metric1 = exercise && metricsById.get(exercise.metric1Id);
    const metric2 = exercise?.metric2Id ? metricsById.get(exercise.metric2Id) : null;
    if (!exercise || !metric1) throw new Error('Sincronize o catálogo de exercícios antes de criar este treino.');
    return {
      id: -(index + 1), exerciseId: exercise.id ? Number(exercise.id) : activity.exerciseId,
      position: index + 1,
      prescribedMetric1: input.recordAsCompleted ? null : activity.metric1 ?? null,
      prescribedMetric2: input.recordAsCompleted ? null : activity.metric2 ?? null,
      metric1Type: 'v', metric2Type: activity.type2 ?? null,
      prescribedPse: input.recordAsCompleted ? null : activity.pse ?? null,
      prescribedRestDuration: input.recordAsCompleted ? null : activity.restDuration ?? null,
      performedMetric1: input.recordAsCompleted ? activity.metric1 ?? null : null,
      performedMetric2: input.recordAsCompleted ? activity.metric2 ?? null : null,
      performedPse: input.recordAsCompleted ? activity.pse ?? null : null,
      performedRestDuration: input.recordAsCompleted ? activity.restDuration ?? null : null,
      performedNote: null, setType: activity.setType,
      startedAt: input.recordAsCompleted ? startedAt : input.startImmediately ? startedAt : null,
      finishedAt: input.recordAsCompleted ? finishedAt : null,
      status: input.recordAsCompleted ? 'completed' : input.startImmediately ? 'in_progress' : 'pending',
      exercise: {
        id: Number(exercise.id), name: exercise.name, description: exercise.description,
        metric_1: { ...metric1, id: Number(metric1.id) }, ...(metric2 ? { metric_2: { ...metric2, id: Number(metric2.id) } } : {}),
      },
      referenceGroup: null, referencePersonalRecord: null,
    };
  });
  const workout: WorkoutDetail = {
    id: crypto.randomUUID(), athleteId: userId, createdBy: userId,
    templateName: input.name?.trim() || `Treino de ${userName?.trim().split(/\s+/)[0] || 'atleta'}`,
    templateDescription: input.description?.trim() ?? '',
    scheduledDate: input.scheduledDate ?? null,
    performedAt: startedAt, finishedAt,
    status: input.recordAsCompleted ? 'completed' : input.startImmediately ? 'in_progress' : input.scheduledDate ? 'scheduled' : 'pending',
    syncRevision: 0, executions,
    exerciseNotes: activities.filter((activity) => activity.note).map((activity) => ({
      exerciseId: activity.exerciseId, note: null, athleteNote: activity.note ?? null,
    })),
    measurements: [],
  };
  await updatePendingWorkout(userId, workout);
  return workout;
}

export async function editLocalWorkout(userId: string, workoutId: string, updater: (workout: WorkoutDetail) => WorkoutDetail): Promise<WorkoutDetail> {
  await waitForPendingWorkoutWrites(userId, workoutId);
  const current = await readCurrentWorkout(userId, workoutId);
  if (!current || current.workout.athleteId !== userId) throw new Error('Treino não disponível neste dispositivo.');
  const updated = updater(current.workout);
  await updatePendingWorkout(userId, updated);
  return updated;
}

export async function updateLocalDraft(userId: string, workoutId: string, input: CreateMyWorkoutDto): Promise<WorkoutDetail> {
  const [exercises, metrics] = await Promise.all([
    readCatalogRows<ExerciseParameter>('exercises'), readCatalogRows<CachedMetric>('metrics'),
  ]);
  const byExercise = new Map(exercises.map((item) => [Number(item.id), item]));
  const byMetric = new Map(metrics.map((item) => [Number(item.id), item]));
  return editLocalWorkout(userId, workoutId, (current) => {
    if (current.createdBy !== userId || !['pending', 'scheduled'].includes(current.status))
      throw new Error('Este treino não pode ser editado estruturalmente.');
    const executions: WorkoutExecution[] = (input.activities ?? []).map((activity, index) => {
      const exercise = byExercise.get(activity.exerciseId);
      const metric1 = exercise && byMetric.get(exercise.metric1Id);
      const metric2 = exercise?.metric2Id ? byMetric.get(exercise.metric2Id) : null;
      if (!exercise || !metric1) throw new Error('Sincronize o catálogo de exercícios antes de editar o treino.');
      return { id: -(index + 1), exerciseId: activity.exerciseId, position: index + 1,
        prescribedMetric1: activity.metric1 ?? null, prescribedMetric2: activity.metric2 ?? null,
        prescribedPse: activity.pse ?? null, prescribedRestDuration: activity.restDuration ?? null,
        metric1Type: 'v', metric2Type: activity.type2 ?? null, setType: activity.setType,
        performedMetric1: null, performedMetric2: null, performedPse: null,
        performedRestDuration: null, performedNote: null, status: 'pending', startedAt: null, finishedAt: null,
        exercise: { id: Number(exercise.id), name: exercise.name, description: exercise.description,
          metric_1: { ...metric1, id: Number(metric1.id) }, ...(metric2 ? { metric_2: { ...metric2, id: Number(metric2.id) } } : {}) },
        referenceGroup: null, referencePersonalRecord: null };
    });
    return { ...current, templateName: input.name?.trim() || current.templateName,
      templateDescription: input.description?.trim() ?? '', scheduledDate: input.scheduledDate ?? null,
      status: input.scheduledDate ? 'scheduled' : 'pending', executions,
      exerciseNotes: (input.activities ?? []).filter((activity) => activity.note).map((activity) => ({ exerciseId: activity.exerciseId, note: null, athleteNote: activity.note ?? null })) };
  });
}

async function applyIncrementalPull(userId: string, payload: PullResponse): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, META], 'readwrite');
    const store = tx.objectStore(CONFIRMED);
    for (const id of payload.deletedIds) store.delete(key(userId, id));
    for (const workout of payload.workouts) {
      if (workout.athleteId !== userId) { tx.abort(); break; }
      store.put({ id: key(userId, workout.id), userId, workout, synchronized: true, revision: 0, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
    }
    tx.objectStore(META).put({ id: metaId(userId), cursor: payload.cursor });
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error ?? new Error('Carga inválida.')); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function applyFullPull(userId: string, payload: PullResponse): Promise<void> {
  const stageDb = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = stageDb.transaction(STAGING, 'readwrite');
    const store = tx.objectStore(STAGING);
    const existing = store.getAll();
    existing.onsuccess = () => {
      for (const row of existing.result as LocalWorkout[]) if (row.userId === userId) store.delete(row.id);
      for (const workout of payload.workouts) {
        if (workout.athleteId !== userId) { tx.abort(); return; }
        store.put({ id: key(userId, workout.id), userId, workout, synchronized: true, revision: 0, operationId: '', savedAt: new Date().toISOString() } satisfies LocalWorkout);
      }
    };
    tx.oncomplete = () => { stageDb.close(); resolve(); };
    tx.onabort = () => { stageDb.close(); reject(tx.error ?? new Error('Carga inválida.')); };
    tx.onerror = () => { stageDb.close(); reject(tx.error); };
  });
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CONFIRMED, STAGING, META], 'readwrite');
    const confirmed = tx.objectStore(CONFIRMED);
    const staged = tx.objectStore(STAGING);
    const existing = confirmed.getAll();
    existing.onsuccess = () => {
      for (const row of existing.result as LocalWorkout[]) if (row.userId === userId) confirmed.delete(row.id);
      const rows = staged.getAll();
      rows.onsuccess = () => {
        for (const row of rows.result as LocalWorkout[]) if (row.userId === userId) {
          confirmed.put(row);
          staged.delete(row.id);
        }
        tx.objectStore(META).put({ id: metaId(userId), cursor: payload.cursor });
      };
    };
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(tx.error); };
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

const pullPromises = new Map<string, Promise<PullResponse>>();

export function pullWorkouts(userId: string, full = false): Promise<PullResponse> {
  const existing = pullPromises.get(userId);
  if (existing && !full) return existing;
  const task = full && existing ? existing.then(() => pullWorkoutsOnce(userId, true)) : pullWorkoutsOnce(userId, full);
  pullPromises.set(userId, task);
  void task.finally(() => { if (pullPromises.get(userId) === task) pullPromises.delete(userId); }).catch(() => undefined);
  return task;
}

async function pullWorkoutsOnce(userId: string, full = false): Promise<PullResponse> {
  const cursor = full ? null : await readWorkoutCursor(userId);
  const endpoint = cursor ? `workouts/me/sync?cursor=${encodeURIComponent(cursor)}` : 'workouts/me/sync';
  let response = await authenticatedRequest<PullResponse>(endpoint);
  if (response.status === 410 && cursor)
    response = await authenticatedRequest<PullResponse>('workouts/me/sync');
  if (!response.success || !response.data) throw new Error(response.error || 'Não foi possível buscar os treinos.');
  if (response.data.full) await applyFullPull(userId, response.data);
  else await applyIncrementalPull(userId, response.data);
  return response.data;
}

export type WorkoutSyncResult = { synchronized: number; errors: string[] };
const syncPromises = new Map<string, Promise<WorkoutSyncResult>>();

export function syncPendingWorkouts(userId: string, options: { workoutId?: string; excludeActive?: boolean } = {}): Promise<WorkoutSyncResult> {
  const existing = syncPromises.get(userId);
  if (existing) return existing;
  const task = syncPendingWorkoutsOnce(userId, options);
  syncPromises.set(userId, task);
  void task.finally(() => { if (syncPromises.get(userId) === task) syncPromises.delete(userId); }).catch(() => undefined);
  return task;
}

const generalSyncPromises = new Map<string, Promise<WorkoutSyncResult>>();

export function synchronizeAll(userId: string, full = false): Promise<WorkoutSyncResult> {
  const existing = generalSyncPromises.get(userId);
  if (existing && !full) return existing;
  const task = (async () => {
    await waitForAccountCacheReset();
    if (existing) await existing.catch(() => undefined);
    await Promise.all([metricsService.sync(), exercisesService.syncCatalog(full), pullWorkouts(userId, full)]);
    const result = await syncPendingWorkouts(userId, { excludeActive: true });
    if ((await readPendingWorkouts(userId)).some((row) => row.workout.status === 'in_progress'))
      result.errors.push('Há treino em andamento aguardando a sincronização de um minuto.');
    return result;
  })();
  generalSyncPromises.set(userId, task);
  void task.finally(() => { if (generalSyncPromises.get(userId) === task) generalSyncPromises.delete(userId); }).catch(() => undefined);
  return task;
}

async function syncPendingWorkoutsOnce(userId: string, options: { workoutId?: string; excludeActive?: boolean }, retryDepth = 0): Promise<WorkoutSyncResult> {
  const result: WorkoutSyncResult = { synchronized: 0, errors: [] };
  let trainerReconciled = false;
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    result.errors.push('É necessária conexão para sincronizar.');
    return result;
  }
  const pending = await readPendingWorkouts(userId);
  for (const initial of pending) {
    if (options.workoutId && initial.workout.id !== options.workoutId) continue;
    if (options.excludeActive && initial.workout.status === 'in_progress') continue;
    try {
      await waitForPendingWorkoutWrites(userId, initial.workout.id);
      const row = await readPendingWorkout(userId, initial.workout.id);
      if (!row) continue;
      if (row.conflict) {
        result.errors.push(`${row.workout.templateName}: escolha uma versão para resolver o conflito.`);
        continue;
      }
      if (row.workout.athleteId !== userId) {
        result.errors.push(`O treino ${row.workout.templateName} requer conciliação antes do envio.`);
        continue;
      }
      const submission = await preparePendingSubmission(row);
      if (!submission) continue;
      const executions = submission.workout.executions
        .filter((item) => !item.pendingRemoval)
        .map((item, index) => ({
          id: item.id > 0 ? item.id : undefined,
          exerciseId: item.exerciseId,
          position: index + 1,
          ...(submission.workout.createdBy === userId || item.setType === 'contingencia_offline' ? { metric2Type: item.metric2Type } : {}),
          ...(submission.workout.createdBy === userId || item.setType === 'contingencia_offline' ? {
            prescribedMetric1: item.prescribedMetric1,
            prescribedMetric2: item.prescribedMetric2,
            prescribedPse: item.prescribedPse,
            prescribedRestDuration: item.prescribedRestDuration,
            setType: item.setType,
          } : {}),
          performedMetric1: item.performedMetric1,
          performedMetric2: item.performedMetric2,
          performedPse: item.performedPse,
          performedRestDuration: item.performedRestDuration,
          performedNote: item.performedNote,
          adherenceSnapshot: item.adherenceSnapshot,
          status: item.status,
          startedAt: item.startedAt,
          finishedAt: item.finishedAt,
        }));
      const notes = submission.workout.exerciseNotes.map(({ exerciseId, athleteNote }) => ({ exerciseId, athleteNote }));
      const response = await authenticatedRequest<WorkoutDetail>('workouts/me/sync', {
        method: 'POST',
        body: JSON.stringify({
          operationId: submission.operationId,
          resolution: submission.resolution,
          id: submission.workout.id,
          baseRevision: submission.workout.syncRevision,
          templateName: submission.workout.templateName,
          templateDescription: submission.workout.templateDescription,
          scheduledDate: submission.workout.scheduledDate,
          performedAt: submission.workout.performedAt,
          finishedAt: submission.workout.finishedAt,
          status: submission.workout.status,
          executions,
          exerciseNotes: notes,
        }),
      });
      if (!response.success || !response.data) {
        if (response.status === 409 && response.currentState?.id === row.workout.id) {
          const latest = await readPendingWorkout(userId, row.workout.id);
          if (response.currentState.updatedBy && response.currentState.updatedBy !== userId &&
              latest && !latest.conflict && latest.workout.createdBy !== userId &&
              (latest.workout.status === 'in_progress' && response.currentState.status === 'in_progress' ||
                latest.workout.status === 'completed' && ['pending', 'scheduled', 'in_progress'].includes(response.currentState.status)) &&
              !latest.workout.executions.some((local) => local.status === 'completed' && local.id > 0 &&
                !response.currentState!.executions.some((server) => server.id === local.id))) {
            await reconcileTrainerConflict(userId, latest, response.currentState);
            trainerReconciled = true;
            window.dispatchEvent(new CustomEvent('workout-trainer-reconciled', { detail: { workoutId: row.workout.id } }));
            continue;
          }
          await recordWorkoutConflict(userId, row.workout.id, response.currentState);
          window.dispatchEvent(new CustomEvent('workout-sync-conflict', { detail: { workoutId: row.workout.id } }));
        }
        result.errors.push(`${row.workout.templateName}: ${response.error || 'Falha na sincronização.'}`);
        continue;
      }
      const confirmed = await (submission.resolution === 'copy'
        ? confirmCopiedWorkout(userId, submission.workout.id, response.data, submission.revision, submission.workout)
        : confirmPendingWorkout(userId, response.data, submission.revision, submission.workout));
      if (submission.resolution === 'copy') window.dispatchEvent(new CustomEvent('workout-sync-copy', { detail: { originalId: submission.workout.id, copyId: response.data.id } }));
      if (confirmed) {
        result.synchronized++;
      }
      else result.errors.push(`${row.workout.templateName}: há alterações novas aguardando sincronização.`);
    } catch (cause) {
      result.errors.push(`${initial.workout.templateName}: ${cause instanceof Error ? cause.message : 'Falha na sincronização.'}`);
    }
  }
  if (trainerReconciled && retryDepth < 1) {
    const retry = await syncPendingWorkoutsOnce(userId, options, retryDepth + 1);
    result.synchronized += retry.synchronized;
    result.errors.push(...retry.errors);
  }
  if (!(await readPendingWorkouts(userId)).filter((row) =>
    (!options.workoutId || row.workout.id === options.workoutId) &&
    (!options.excludeActive || row.workout.status !== 'in_progress')).length) return result;
  if (!result.errors.length) result.errors.push('Ainda há treinos aguardando sincronização.');
  return result;
}
