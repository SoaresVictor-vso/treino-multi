import ComingSoon from '@/components/athlete-app/ComingSoon';
import { RiSettings3Line } from 'react-icons/ri';

export default function PerfilPage() {
	return (
		<ComingSoon
			eyebrow="Sua conta, do seu jeito"
			title="Perfil em preparação"
			description="Logo você poderá ajustar nome, e-mail, senha e as preferências da sua experiência por aqui."
			icon={RiSettings3Line}
		/>
	);
}
