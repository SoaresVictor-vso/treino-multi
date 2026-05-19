export enum Permission {
  // Tenants
  TENANT_CREATE = 'tenant:create',
  TENANT_READ = 'tenant:read',
  TENANT_UPDATE = 'tenant:update',
  TENANT_DELETE = 'tenant:delete',

  // Usuários
  USER_CREATE = 'user:create',
  USER_READ = 'user:read',
  USER_UPDATE = 'user:update',
  USER_DELETE = 'user:delete',
  USER_IMPERSONATE = 'user:impersonate',
  USER_PASSWORD_RESET = 'user:password-reset',

  // Autenticação
  AUTH_LOGIN = 'auth:login',
  AUTH_LOGOUT = 'auth:logout',
  AUTH_REFRESH_TOKEN = 'auth:refresh-token',

  // Logs
  LOG_READ = 'log:read',

  // Financeiro
  FINANCIAL_INVOICES_READ = 'financial:invoices:read',
  FINANCIAL_INVOICES_CREATE = 'financial:invoices:create',
  FINANCIAL_REPORTS_READ = 'financial:reports:read',

  // Atendimento
  ATTENDANCE_TICKETS_READ = 'attendance:tickets:read',
  ATTENDANCE_TICKETS_CREATE = 'attendance:tickets:create',
  ATTENDANCE_TICKETS_UPDATE = 'attendance:tickets:update',
}
