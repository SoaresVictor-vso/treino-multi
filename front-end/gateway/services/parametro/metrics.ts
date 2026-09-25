import { enums } from '@treino-multi/shared';
const { MetricFieldType } = enums;
export type MetricFieldType = enums.MetricFieldType;
export { MetricFieldType };
import { authenticatedRequest } from '@/gateway/client';




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
