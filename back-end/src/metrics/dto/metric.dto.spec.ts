import { validate } from 'class-validator';
import { CreateMetricDto } from './create-metric.dto';
import { UpdateMetricDto } from './update-metric.dto';
import { MetricFieldType } from '../../common/enums/metric-field-type.enum';

describe('Metric DTOs', () => {
	const valid = (): CreateMetricDto => ({
		name: 'repeticoes',
		symbol: 'rep',
		fieldType: MetricFieldType.INT,
	});

	it('aceita DTO de criação válido', async () => {
		expect(
			await validate(Object.assign(new CreateMetricDto(), valid())),
		).toHaveLength(0);
	});

	it('rejeita campos obrigatórios ausentes ou longos demais', async () => {
		const dto = Object.assign(new CreateMetricDto(), valid(), {
			name: 'x'.repeat(11),
			symbol: 'x'.repeat(7),
			fieldType: 'number',
		});
		expect(await validate(dto)).not.toHaveLength(0);
	});

	it('aceita atualização parcial', async () => {
		expect(
			await validate(Object.assign(new UpdateMetricDto(), { symbol: 'kg' })),
		).toHaveLength(0);
	});
});
