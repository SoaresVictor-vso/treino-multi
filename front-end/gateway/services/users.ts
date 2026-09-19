import { authenticatedRequest } from '../client';
import { UsersListResponseDto } from '../dto/user/list-user.dto';
import { Role } from '@/lib/roles';
import { CreateUserDto } from '../dto/user/create-user.dto';
import { UserListItemDto } from '../dto/user/list-user.dto';

export type UpdateUserDto = {
	name: string;
	email: string;
	document?: string | null;
	fone?: string | null;
	isActive: boolean;
};

export type OwnProfileDto = {
	id: string;
	name: string;
	email: string | null;
	phone: string | null;
	document: string | null;
};

export type UpdateOwnProfileDto = {
	name: string;
	email: string | null;
	phone: string | null;
	document?: string | null;
};

export type ParamsFindUsers = {
	tenantId?: string;
	name?: string;
	role?: Role;
	orderBy?: 'id' | 'createdAt' | 'updatedAt' | 'name';
	start?: string;
	limit?: number;
};

export class UsersService {
	private readonly apiUrl = 'users';

	async create(payload: CreateUserDto) {
		return authenticatedRequest<UserListItemDto>(this.apiUrl, {
			method: 'POST',
			body: JSON.stringify(payload),
		});
	}

	async update(id: string, payload: UpdateUserDto) {
		return authenticatedRequest<UserListItemDto>(`${this.apiUrl}/${id}`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		});
	}

	async findMultiple(params: ParamsFindUsers) {
		const searchParams = new URLSearchParams();

		Object.entries(params).forEach(([key, value]) => {
			if (value === undefined || value === null || value === '') return;
			searchParams.set(key, String(value));
		});

		const queryString = searchParams.toString();

		return authenticatedRequest<UsersListResponseDto>(
			queryString ? `${this.apiUrl}?${queryString}` : this.apiUrl,
			{ method: 'GET' },
		);
	}

	async getMe() {
		return authenticatedRequest<OwnProfileDto>(`${this.apiUrl}/me`, {
			method: 'GET',
		});
	}

	async updateMe(payload: UpdateOwnProfileDto) {
		return authenticatedRequest<OwnProfileDto>(`${this.apiUrl}/me`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		});
	}

	async changeMyPassword(payload: {
		currentPassword: string;
		newPassword: string;
	}) {
		return authenticatedRequest<void>(`${this.apiUrl}/me/password`, {
			method: 'PATCH',
			body: JSON.stringify(payload),
		});
	}
}
