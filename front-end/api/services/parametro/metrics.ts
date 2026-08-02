import { authenticatedRequest } from '@/api/client';

export type Metrics = {
	id: string;
	name: string;
};

export interface MetricsServiceContract {
	search(referencia: string | null): Promise<Metrics[]>;
}

export class MetricsService implements MetricsServiceContract {
	public async search(): Promise<Metrics[]> {
		return (await authenticatedRequest<Metrics[]>('metrics')).data || [];
	}
}

export const metricsService = new MetricsService();
