import { Role } from "@/lib/roles";

export type CreateUserDto = {
  name: string;
  email: string;
  document?: string | null;
  phone?: string | null;
  tenantId?: string | null;
  context: "organization" | "tenant" | "standalone";
  password: string;
  isActive?: boolean;
  roles: Role[];
};
