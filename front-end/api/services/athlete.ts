import { authenticatedRequest } from '../client';

export type Athlete = {
	id: string;
	isActive: boolean;
	person: { name: string; email: string | null; phone: string | null };
	activeAssociation?: {
		id: string;
		startDate: string;
		trainer: { id: string; person: { name: string } };
	} | null;
};

export type TrainerOption = { id: string; person: { name: string } };

export type GenerateWorkoutsFromTemplateResponse = { count: number };

export class AthleteService {
	async findAthletes() {
		return authenticatedRequest<Athlete[]>('athlete/athletes', {
			method: 'GET',
		});
	}

	async findTrainers() {
		return authenticatedRequest<TrainerOption[]>('athlete/trainers', {
			method: 'GET',
		});
	}

	async associate(athleteId: string, trainerId: string, startDate: string) {
		return authenticatedRequest('athlete/associations', {
			method: 'POST',
			body: JSON.stringify({ athleteId, trainerId, startDate }),
		});
	}

	async associateMany(athleteIds: string[], trainerId: string, startDate: string) {
		return authenticatedRequest<{ count: number }>('athlete/associations/bulk', {
			method: 'POST',
			body: JSON.stringify({ athleteIds, trainerId, startDate }),
		});
	}

	async generateWorkoutsFromTemplate(
		athleteIds: string[],
		templateId: string,
		scheduledDate?: string,
	) {
		return authenticatedRequest<GenerateWorkoutsFromTemplateResponse>(
			'athlete/workouts/from-template',
			{
				method: 'POST',
				body: JSON.stringify({ athleteIds, templateId, scheduledDate }),
			},
		);
	}

	async endAssociation(id: string, endDate?: string) {
		return authenticatedRequest(`athlete/associations/${id}/end`, {
			method: 'PATCH',
			body: JSON.stringify(endDate ? { endDate } : {}),
		});
	}
}
