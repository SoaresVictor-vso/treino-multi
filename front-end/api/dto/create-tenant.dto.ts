export class CreateTenantDto {
  name = "";
  slug = "";
  isActive = true;
  adminName = "";
  adminEmail = "";
  adminDocument = "";
  adminPhone = "";
  adminPassword = "";

  constructor(data?: Partial<CreateTenantDto>) {
    Object.assign(this, data);
    this.isActive = data?.isActive ?? true;
    this.adminPhone = data?.adminPhone ?? "";
  }
}
