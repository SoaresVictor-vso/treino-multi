import { authenticatedRequest } from "../client";
import { UsersListResponseDto } from "../dto/user/list-user.dto";
import { Role } from "@/lib/roles";

export type ParamsFindUsers = {
  tenantId?: string;
  name?: string;
  role?: Role;
  orderBy?: "id" | "createdAt" | "updatedAt" | "name";
  start?: string;
  limit?: number;
};

export class UsersService {
  private readonly apiUrl = "users";

  async findMultiple(params: ParamsFindUsers) {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") return;
      searchParams.set(key, String(value));
    });

    const queryString = searchParams.toString();

    return authenticatedRequest<UsersListResponseDto>(
      queryString ? `${this.apiUrl}?${queryString}` : this.apiUrl,
      { method: "GET" },
    );
  }
}
