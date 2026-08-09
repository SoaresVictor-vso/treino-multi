'use client';

import Button from '@/components/ui/Button';
import PersonalRecordModal from './PersonalRecordModal';

export default function PersonalRecordRequiredModal({
	isOpen,
	exercises,
	onClose,
}: {
	isOpen: boolean;
	exercises: { name: string; groupName?: string | null }[];
	onClose: () => void;
}) {
	return (
		<PersonalRecordModal isOpen={isOpen} title="RP de referência necessário" description="Este treino possui séries em porcentagem, mas não há um 1RM registrado para a referência abaixo." onClose={onClose}>
			<div className="space-y-5">
				<div className="rounded-xl border border-outline-variant bg-surface-container-high p-4">
					<p className="text-sm text-on-surface-variant">Peça ao responsável pelo treino para registrar o RP antes de executar estas séries.</p>
					<ul className="mt-3 space-y-2 text-sm text-primary">
						{exercises.map((exercise) => <li key={`${exercise.name}-${exercise.groupName ?? ''}`}>{exercise.name}{exercise.groupName ? ` · grupo ${exercise.groupName}` : ''}</li>)}
					</ul>
				</div>
				<div className="flex justify-end"><Button onClick={onClose}>Entendi</Button></div>
			</div>
		</PersonalRecordModal>
	);
}
