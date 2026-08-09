import TrainingExecution from '@/components/training/TrainingExecution';

export default async function TrainingPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return <TrainingExecution id={id} />;
}
