import { enums } from '@treino-multi/shared';
const { MetricFieldType } = enums;
export type MetricFieldType = enums.MetricFieldType;
export { MetricFieldType };
import { authenticatedRequest } from '@/gateway/client';
import { readCatalogRows, replaceCatalogRows } from '@/lib/offline-catalog';




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
	private syncPromise: Promise<Metric[]> | null = null;
	public async search(): Promise<Metric[]> {
		const cached = await readCatalogRows<Omit<Metric, 'id'> & { id: string }>('metrics');
		return cached.map((item) => ({ ...item, id: Number(item.id) }));
	}
	public sync(): Promise<Metric[]> {
		if (!this.syncPromise) this.syncPromise = this.syncOnce().finally(() => { this.syncPromise = null; });
		return this.syncPromise;
	}
	public async waitForSync(): Promise<void> {
		if (this.syncPromise) await this.syncPromise.catch(() => undefined);
	}
	private async syncOnce(): Promise<Metric[]> {
		const response = await authenticatedRequest<Metric[]>('metrics');
		if (!response.success || !response.data) throw new Error(response.error || 'Falha ao sincronizar métricas.');
		await replaceCatalogRows('metrics', response.data.map((item) => ({ ...item, id: String(item.id) })));
		return response.data;
	}
}

export const metricsService = new MetricsService();
