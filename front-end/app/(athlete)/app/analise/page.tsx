import ComingSoon from '@/components/athlete-app/ComingSoon';
import { RiBarChartBoxLine } from 'react-icons/ri';

export default function AnalisePage() {
	return (
		<ComingSoon
			eyebrow="Dados que fazem sentido"
			title="Sua análise está chegando"
			description="Estamos preparando um painel para visualizar conquistas, registrar PRs e entender sua evolução sem ruído."
			icon={RiBarChartBoxLine}
		/>
	);
}
