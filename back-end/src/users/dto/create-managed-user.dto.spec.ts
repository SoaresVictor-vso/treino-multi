import { validate } from 'class-validator';
import { CreateManagedUserDto } from './create-managed-user.dto';

const validUser = (tenantFunction: 'admin' | 'trainer' | 'client') =>
	Object.assign(new CreateManagedUserDto(), {
		name: 'João da Silva',
		email: 'joao@example.com',
		phone: '11999990000',
		tenantId: 'f7b3b53b-d6f6-431f-814c-cb8406f00121',
		context: 'tenant',
		password: 'Senha@123',
		tenantFunction,
	});

describe('CreateManagedUserDto', () => {
	it('aceita cliente de tenant sem documento', async () => {
		const dto = validUser('client');

		expect(await validate(dto)).toHaveLength(0);
	});

	it.each(['admin', 'trainer'] as const)(
		'exige documento para %s de tenant',
		async (tenantFunction) => {
			const dto = validUser(tenantFunction);

			const errors = await validate(dto);
			expect(errors.some((error) => error.property === 'document')).toBe(true);
		},
	);
});
