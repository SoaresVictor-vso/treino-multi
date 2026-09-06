import ComingSoon from '@/components/athlete-app/ComingSoon';
import { RiMedalLine } from 'react-icons/ri';

export default function ConquistasPage() {
	return (
		<ComingSoon
			eyebrow="Sua vitrine de evolução"
			title="Conquistas em preparação"
			description="Em breve, suas sequências, marcos e medalhas desbloqueadas vão ganhar um lugar especial aqui."
			icon={RiMedalLine}
		/>
	);
}
