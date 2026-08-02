import {
	CPF_MASK_REGEX,
	CNPJ_MASK_REGEX,
	PHONE_MASK_REGEX,
	MaskRegex,
} from './constants';

export function mask(
	value: string | null,
	maskType: 'cpf' | 'cnpj' | 'phone',
): string {
	if (!value) return '';
	console.log(`Masking value: ${value} with mask type: ${maskType}`);
	switch (maskType) {
		case 'cpf':
			return applyMask(value, CPF_MASK_REGEX);
		case 'cnpj':
			return applyMask(value, CNPJ_MASK_REGEX);
		case 'phone':
			return applyMask(value, PHONE_MASK_REGEX);
		default:
			return value;
	}
}

function applyMask(value: string, maskRegex: MaskRegex): string {
	console.log(`Applying mask: ${maskRegex.replacement} to value: ${value}`);
	return value.replace(maskRegex.regex, maskRegex.replacement);
}

export function secondsToTime(seconds: number): string {
	const hours = Math.floor(seconds / 3600);
	const minutes = Math.floor((seconds % 3600) / 60);
	const secs = seconds % 60;
	return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function timeToSeconds(time: string): number {
	const [hours = 0, minutes = 0, seconds = 0] = time.split(':').map(Number);
	return hours * 3600 + minutes * 60 + seconds;
}
