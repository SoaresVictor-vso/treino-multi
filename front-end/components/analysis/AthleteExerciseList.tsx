import Link from 'next/link';

export default function AthleteExerciseList({ athleteId, exercises }: { athleteId: string; exercises: { exerciseId: number; name: string; totalWorkouts: number }[] }) {
  return <section><h2 className="text-xl font-bold">Exercícios já realizados</h2>
    {exercises.length ? <div className="mt-3 grid gap-2 sm:grid-cols-2">{exercises.map((exercise) =>
      <Link key={exercise.exerciseId} href={`/athlete/${athleteId}/exercises/${exercise.exerciseId}`}
        className="flex items-center justify-between rounded-xl border border-outline-variant bg-surface-container-low p-4 hover:border-primary-fixed">
        <span className="font-semibold">{exercise.name}</span><span className="text-sm text-on-surface-variant">{exercise.totalWorkouts} {exercise.totalWorkouts === 1 ? 'treino' : 'treinos'} →</span>
      </Link>)}</div> : <p className="mt-3 text-on-surface-variant">Nenhum exercício realizado ainda.</p>}
  </section>;
}
