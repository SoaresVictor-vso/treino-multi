import { authenticatedRequest } from '@/gateway/client';

export type PersonalRecord = {
	id: string;
	value: number;
	measuredAt: string;
	exerciseGroup?: { id: number; name: string } | null;
	exercise?: { id: number; name: string } | null;
};

export type CreatePersonalRecordDto = {
	athleteId: string;
	exerciseGroupId?: number;
	exerciseId?: number;
	value: number;
	measuredAt: string;
};

export const personalRecordsService = {
	findByAthlete: (athleteId: string) =>
		authenticatedRequest<PersonalRecord[]>(
			`personal-records/athletes/${athleteId}`,
		),
	create: (dto: CreatePersonalRecordDto) =>
		authenticatedRequest<PersonalRecord>('personal-records', {
			method: 'POST',
			body: JSON.stringify(dto),
		}),
};
