import { validate } from 'class-validator';
import { CreateExerciseDto } from './create-exercise.dto';
import { UpdateExerciseDto } from './update-exercise.dto';

describe('Exercise DTOs', () => {
  const valid = (): CreateExerciseDto => ({ name: 'Agachamento', metric1Id: 1, metric2Id: 2, visualUrl: 'https://example.com/a.gif' });

  it('aceita criação válida', async () => {
    expect(await validate(Object.assign(new CreateExerciseDto(), valid()))).toHaveLength(0);
  });

  it('rejeita métrica primária inválida e URL inválida', async () => {
    const dto = Object.assign(new CreateExerciseDto(), valid(), { metric1Id: 0, visualUrl: 'arquivo.gif' });
    expect(await validate(dto)).not.toHaveLength(0);
  });

  it('aceita atualização parcial', async () => {
    expect(await validate(Object.assign(new UpdateExerciseDto(), { name: 'Leg press' }))).toHaveLength(0);
  });
});