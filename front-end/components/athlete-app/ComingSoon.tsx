import type { IconType } from 'react-icons';
import { RiSparkling2Line } from 'react-icons/ri';

export default function ComingSoon({
	eyebrow,
	title,
	description,
	icon: Icon,
}: {
	eyebrow: string;
	title: string;
	description: string;
	icon: IconType;
}) {
	return (
		<section className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-2xl items-center justify-center py-8 text-center">
			<div className="relative w-full overflow-hidden rounded-[2rem] border border-primary-container/20 bg-surface-container-low/85 px-6 py-14 shadow-2xl shadow-black/30 sm:px-12">
				<div className="athlete-orbit athlete-orbit-one" aria-hidden />
				<div className="athlete-orbit athlete-orbit-two" aria-hidden />
				<div className="relative mx-auto grid h-24 w-24 place-items-center rounded-[2rem] border border-primary-container/30 bg-primary-container text-on-primary-fixed shadow-[0_0_48px_rgba(195,244,0,0.3)]">
					<Icon size={44} aria-hidden />
				</div>
				<div className="relative mt-8">
					<p className="type-label-caps inline-flex items-center gap-2 rounded-full border border-primary-container/20 bg-primary-container/10 px-3 py-1.5 text-primary-fixed">
						<RiSparkling2Line aria-hidden /> {eyebrow}
					</p>
					<h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
					<p className="mx-auto mt-4 max-w-md text-sm leading-6 text-on-surface-variant sm:text-base">
						{description}
					</p>
					<div className="mx-auto mt-8 flex w-fit items-center gap-3 rounded-2xl border border-white/8 bg-surface-container px-4 py-3 text-left">
						<span className="relative flex h-3 w-3">
							<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary-container opacity-75" />
							<span className="relative inline-flex h-3 w-3 rounded-full bg-primary-container" />
						</span>
						<span className="text-sm font-semibold text-on-surface">Em construção</span>
					</div>
				</div>
			</div>
		</section>
	);
}
