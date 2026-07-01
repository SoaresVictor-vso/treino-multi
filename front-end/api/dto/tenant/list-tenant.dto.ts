export type TenantListItemDto = {
  id: string;
  name: string;
  tradeName: string | null;
  registeredName: string | null;
  slug: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
