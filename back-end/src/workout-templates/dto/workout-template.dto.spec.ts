import 'reflect-metadata';
import { validate } from 'class-validator';
import { ActivityDto } from './activity.dto';
import { CreateWorkoutTemplateDto } from './create-workout-template.dto';
import { UpdateWorkoutTemplateDto } from './update-workout-template.dto';

const uuid = 'd2719f58-929d-4c18-b0d5-1ec3213918be';

describe('Workout template DTOs', () => {
  it('aceita template e atividade válidos', async () => {
    const dto = Object.assign(new CreateWorkoutTemplateDto(), {
      tenantId: uuid, createdBy: uuid, updatedBy: uuid, name: 'Treino A', description: 'Base',
      activities: [Object.assign(new ActivityDto(), { exerciseId: 1, type1: 'v', pse: 8 })],
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejeita UUID e tipos de registro inválidos', async () => {
    const activity = Object.assign(new ActivityDto(), { exerciseId: 0, type1: 'p', type2: 'x', pse: 8 });
    expect(await validate(activity)).not.toHaveLength(0);
    const template = Object.assign(new CreateWorkoutTemplateDto(), { tenantId: 'inválido' });
    expect(await validate(template)).not.toHaveLength(0);
  });

  it('aceita atualização parcial', async () => {
    expect(await validate(Object.assign(new UpdateWorkoutTemplateDto(), { name: 'Treino B' }))).toHaveLength(0);
  });
});