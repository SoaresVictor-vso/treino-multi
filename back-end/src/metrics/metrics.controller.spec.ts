import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';

describe('MetricsController', () => {
  it('lista as métricas', async () => {
    const metrics = [{ id: 1, name: 'repeticoes' }];
    const service = {
      findAll: jest.fn().mockResolvedValue(metrics),
    };
    const controller = new MetricsController(service as unknown as MetricsService);

    await expect(controller.findAll()).resolves.toEqual(metrics);
    expect(service.findAll).toHaveBeenCalledTimes(1);
  });
});