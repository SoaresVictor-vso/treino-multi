import { authenticatedRequest } from '@/gateway/client';

export enum MetricFieldType {
	INT = 'int',
	DECIMAL = 'decimal',
	TIME = 'time',
}

export type Metric = {
	id: number;
	name: string;
	symbol: string;
	fieldType: MetricFieldType;
};
export interface MetricsServiceContract {
	search(referencia: string | null): Promise<Metric[]>;
}

export class MetricsService implements MetricsServiceContract {
	public async search(): Promise<Metric[]> {
		return (await authenticatedRequest<Metric[]>('metrics')).data || [];
	}
}

export const metricsService = new MetricsService();
