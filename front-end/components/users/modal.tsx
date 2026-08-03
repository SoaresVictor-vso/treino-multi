'use client';

import {
	CNPJ_MASK_REGEX,
	CPF_MASK_REGEX,
	CPF_REGEX,
	EMAIL_REGEX,
	PHONE_MASK_REGEX,
	PHONE_REGEX,
} from '@/lib/constants';
import Button from '../ui/Button';
import ErrorBox from '../ui/ErrorBox';
import Input from '../ui/Input';
import Modal from '../ui/Modal';
import Select from '../ui/Select';
import Switch from '../ui/Switch';
import { CreateUserDto, TenantFunction } from '@/api/dto/user/create-user.dto';
import * as yup from 'yup';
import { TenantListItemDto } from '@/api/dto/tenant/list-tenant.dto';
import { UserListItemDto } from '@/api/dto/user/list-user.dto';
import { UsersService } from '@/api/services/users';
import React from 'react';
import { Role } from '@/lib/roles';

const usersService = new UsersService();

const createUserSchema = yup.object({
	name: yup
		.string()
		.trim()
		.required('Nome da pessoa é obrigatório')
		.min(2, 'Nome deve ter pelo menos 2 caracteres'),
	email: yup
		.string()
		.trim()
		.required('E-mail é obrigatório')
		.matches(EMAIL_REGEX, 'Digite um e-mail válido'),
	document: yup
		.string()
		.trim()
		.when('tenantFunction', {
			is: 'client',
			then: (schema) =>
				schema.matches(CPF_REGEX, {
					message: 'Digite um CPF válido',
					excludeEmptyString: true,
				}),
			otherwise: (schema) =>
				schema
					.required('Documento é obrigatório')
					.matches(CPF_REGEX, 'Digite um CPF válido'),
		}),
	phone: yup
		.string()
		.required('Telefone é obrigatório')
		.matches(PHONE_REGEX, 'Digite um telefone válido'),
	password: yup
		.string()
		.required('Senha é obrigatória')
		.min(8, 'A senha deve ter pelo menos 8 caracteres'),
	passwordConfirmation: yup
		.string()
		.required('Confirmação de senha é obrigatória')
		.oneOf([yup.ref('password')], 'As senhas não conferem.'),
	tenantFunction: yup.string().when('tenantId', {
		is: (tenantId: string) => !!tenantId,
		then: (schema) => schema.required('Função é obrigatória'),
	}),
});

const updateUserSchema = yup.object({
	name: yup
		.string()
		.trim()
		.required('Nome da pessoa é obrigatório')
		.min(2, 'Nome deve ter pelo menos 2 caracteres'),
	email: yup
		.string()
		.trim()
		.required('E-mail é obrigatório')
		.matches(EMAIL_REGEX, 'Digite um e-mail válido'),
	document: yup.string().when('documentEditable', {
		is: true,
		then: (schema) =>
			schema
				.required('Documento é obrigatório')
				.matches(CPF_REGEX, 'Digite um CPF válido'),
		otherwise: (schema) => schema.notRequired(),
	}),
	phone: yup
		.string()
		.required('Telefone é obrigatório')
		.matches(PHONE_REGEX, 'Digite um telefone válido'),
	documentEditable: yup.boolean().required(),
});

export default function UserModal(props: {
	isOpen: boolean;
	onClose: () => void;
	isOrgActor: boolean;
	sessionTenantId: string | null;
	tenants: TenantListItemDto[];
	user?: UserListItemDto | null;
	onSaved: () => Promise<void>;
	mode: 'create' | 'view' | 'edit';
}) {
	const mode = props.mode;
	const [form, setForm] = React.useState({
		name: '',
		email: '',
		document: '',
		phone: '',
		tenantId: '',
		tenantFunction: '' as TenantFunction | '',
		password: '',
		passwordConfirmation: '',
		isActive: true,
	});
	const [errors, setErrors] = React.useState<Record<string, string>>({});
	const [isSubmitting, setIsSubmitting] = React.useState(false);

	React.useEffect(() => {
		if (!props.isOpen) return;
		if (props.user) {
			const tenantRole = props.user.userRoles.find((item) =>
				item.role.startsWith('tenant:'),
			)?.role;
			// O formulário é reinicializado quando o registro exibido muda.
			// eslint-disable-next-line react-hooks/set-state-in-effect
			setForm({
				name: props.user.person.name,
				email: props.user.person.email || '',
				document: props.user.person.document || '',
				phone: props.user.person.phone || '',
				tenantId: props.user.tenantId || '',
				tenantFunction:
					tenantRole === Role.TENANT_ADMIN
						? 'admin'
						: tenantRole === Role.TENANT_TRAINER
							? 'trainer'
							: tenantRole === Role.TENANT_CLIENT
								? 'client'
								: '',
				password: '',
				passwordConfirmation: '',
				isActive: props.user.isActive,
			});
			setErrors({});
			return;
		}
		setForm({
			name: '',
			email: '',
			document: '',
			phone: '',
			tenantId: '',
			tenantFunction: '',
			password: '',
			passwordConfirmation: '',
			isActive: true,
		});
		setErrors({});
	}, [props.isOpen, props.user]);

	const effectiveTenantId = props.isOrgActor
		? form.tenantId || null
		: props.sessionTenantId;
	const context: CreateUserDto['context'] = props.isOrgActor
		? effectiveTenantId
			? 'tenant'
			: 'organization'
		: 'tenant';
	const isTenantClient = !!effectiveTenantId && form.tenantFunction === 'client';

	const canSubmit =
		mode === 'edit'
			? form.name.trim().length >= 2 &&
				form.email.trim().length > 0 &&
				form.phone.trim().length > 0 &&
				(!!props.user?.person.document || form.document.trim().length > 0) &&
				!isSubmitting
			: form.name.trim().length >= 2 &&
				form.email.trim().length > 0 &&
				(isTenantClient || form.document.trim().length > 0) &&
				form.phone.trim().length > 0 &&
				form.password.length >= 8 &&
				form.password === form.passwordConfirmation &&
				(!effectiveTenantId || !!form.tenantFunction) &&
				!isSubmitting;
	const submitDisabledReason = (() => {
		if (mode === 'view' || canSubmit) return null;
		if (isSubmitting) return 'Aguarde enquanto o usuário é salvo.';

		const pendingFields: string[] = [];
		if (form.name.trim().length < 2) pendingFields.push('nome');
		if (!form.email.trim()) pendingFields.push('e-mail');
		if (!form.phone.trim()) pendingFields.push('telefone');

		if (
			mode === 'edit'
				? !props.user?.person.document && !form.document.trim()
				: !isTenantClient && !form.document.trim()
		) {
			pendingFields.push('documento');
		}

		if (mode === 'create') {
			if (effectiveTenantId && !form.tenantFunction) {
				pendingFields.push('função');
			}
			if (form.password.length < 8) pendingFields.push('senha de ao menos 8 caracteres');
			if (form.password !== form.passwordConfirmation) {
				pendingFields.push('confirmação de senha igual à senha');
			}
		}

		return `Para habilitar o envio, preencha: ${pendingFields.join(', ')}.`;
	})();

	const updateField = (key: keyof typeof form, value: string | boolean) => {
		setForm((current) => ({ ...current, [key]: value }));
		setErrors((current) => {
			if (!current[key]) return current;
			const next = { ...current };
			delete next[key];
			return next;
		});
	};

	async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
		event.preventDefault();

		if (mode === 'edit' && props.user) {
			try {
				await updateUserSchema.validate(
					{
						...form,
						documentEditable: !props.user.person.document,
					},
					{ abortEarly: false },
				);
				setErrors({});
			} catch (error) {
				if (!(error instanceof yup.ValidationError)) return;

				const nextErrors: Record<string, string> = {};
				error.inner.forEach((validationError) => {
					if (
						validationError.path &&
						validationError.path !== 'documentEditable' &&
						!nextErrors[validationError.path]
					) {
						nextErrors[validationError.path] = validationError.message;
					}
				});
				setErrors(nextErrors);
				return;
			}

			setIsSubmitting(true);
			const result = await usersService.update(props.user.id, {
				name: form.name.trim(),
				email: form.email.trim(),
				document: props.user.person.document
					? undefined
					: form.document.trim() || null,
				fone: form.phone.trim() || null,
				isActive: form.isActive,
			});
			setIsSubmitting(false);
			if (!result.success) {
				setErrors({
					form: result.error || 'Não foi possível atualizar o usuário.',
				});
				return;
			}
			await props.onSaved();
			return;
		}

		try {
			await createUserSchema.validate(form, { abortEarly: false });
			setErrors({});
		} catch (error) {
			if (!(error instanceof yup.ValidationError)) return;

			const nextErrors: Record<string, string> = {};
			error.inner.forEach((validationError) => {
				if (validationError.path && !nextErrors[validationError.path]) {
					nextErrors[validationError.path] = validationError.message;
				}
			});
			setErrors(nextErrors);
			return;
		}

		setIsSubmitting(true);
		const result = await usersService.create({
			name: form.name.trim(),
			email: form.email.trim(),
			document: form.document.trim() || null,
			phone: form.phone.trim() || null,
			tenantId: effectiveTenantId,
			context,
			password: form.password,
			isActive: form.isActive,
			tenantFunction: (form.tenantFunction as TenantFunction) || null,
		});
		setIsSubmitting(false);
		if (!result.success) {
			setErrors({ form: result.error || 'Não foi possível criar o usuário.' });
			return;
		}
		await props.onSaved();
	}

	const title = {
		create: 'Novo usuário',
		view: 'Visualizar usuário',
		edit: 'Editar usuário',
	}[mode];

	return (
		<Modal isOpen={props.isOpen} title={title} onClose={props.onClose}>
			<form className="space-y-6" onSubmit={handleSubmit}>
				<section className="grid gap-4 md:grid-cols-2">
					<Input
						id="user-name"
						label="Nome da pessoa"
						required
						error={errors.name}
						value={form.name}
						disabled={mode === 'view'}
						onChange={(event) => updateField('name', event.target.value)}
					/>
					<Input
						id="user-email"
						label="E-mail"
						type="email"
						required
						error={errors.email}
						value={form.email}
						disabled={mode === 'view'}
						onChange={(event) => updateField('email', event.target.value)}
					/>
					<Input
						id="user-document"
						label="Documento"
						required={!isTenantClient}
						error={errors.document}
						value={form.document}
						disabled={mode === 'view' || !!props.user?.person.document}
						onChange={(event) =>
							updateField(
								'document',
								event.target.value.replace(/\D/g, '').slice(0, 14),
							)
						}
						mask={[
							{ ...CPF_MASK_REGEX, maxLength: 11 },
							{ ...CNPJ_MASK_REGEX, minLength: 12 },
						]}
					/>
					<Input
						id="user-phone"
						label="Telefone"
						required
						error={errors.phone}
						value={form.phone}
						disabled={mode === 'view'}
						onChange={(event) =>
							updateField('phone', event.target.value.replace(/\D/g, '').slice(0, 11))
						}
						mask={PHONE_MASK_REGEX}
					/>
				</section>

				{props.isOrgActor && (
					<Select
						id="user-tenant"
						label="Tenant"
						value={form.tenantId}
						disabled={mode !== 'create'}
						onChange={(event) => updateField('tenantId', event.target.value)}
						placeholder="Organização"
						options={props.tenants.map((tenant) => ({
							value: tenant.id,
							label: tenant.tradeName || tenant.name,
						}))}
						canClear
					/>
				)}

				{effectiveTenantId && (
					<Select
						id="user-function"
						label="Função"
						value={form.tenantFunction}
						disabled={mode !== 'create'}
						onChange={(event) => updateField('tenantFunction', event.target.value)}
						placeholder="Selecione a função"
						options={[
							{ value: 'admin', label: 'Administrador' },
							{ value: 'trainer', label: 'Treinador' },
							{ value: 'client', label: 'Aluno' },
						]}
						error={errors.tenantFunction}
					/>
				)}

				<section className="grid gap-4 md:grid-cols-2">
					{mode === 'create' && (
						<>
							<Input
								id="user-password"
								label="Senha"
								type="password"
								required
								error={errors.password}
								value={form.password}
								disabled={mode !== 'create'}
								onChange={(event) => updateField('password', event.target.value)}
							/>
							<Input
								id="user-password-confirmation"
								label="Confirmação"
								type="password"
								required
								error={errors.passwordConfirmation}
								value={form.passwordConfirmation}
								disabled={mode !== 'create'}
								onChange={(event) =>
									updateField('passwordConfirmation', event.target.value)
								}
							/>
						</>
					)}
				</section>

				<Switch
					id="user-active"
					label="Ativo"
					checked={form.isActive}
					disabled={mode === 'view'}
					onChange={(event) => updateField('isActive', event.target.checked)}
				/>

				{errors.form && <ErrorBox message={errors.form} />}

				<div className="flex flex-col items-end gap-2">
					{submitDisabledReason && (
						<p
							id="user-submit-disabled-reason"
							className="text-right text-sm text-on-surface-variant"
							aria-live="polite"
						>
							{submitDisabledReason}
						</p>
					)}
					<div className="flex items-center justify-end gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={props.onClose}
						disabled={isSubmitting}
					>
						{mode === 'edit' ? 'Cancelar' : 'Fechar'}
					</Button>
					{mode !== 'view' && (
						<Button
							type="submit"
							disabled={!canSubmit}
							aria-describedby={
								submitDisabledReason ? 'user-submit-disabled-reason' : undefined
							}
						>
							{mode === 'edit'
								? isSubmitting
									? 'Salvando...'
									: 'Salvar alterações'
								: isSubmitting
									? 'Salvando...'
									: 'Criar usuário'}
						</Button>
					)}
					</div>
				</div>
			</form>
		</Modal>
	);
}
