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

  // Treinos
  WORKOUT_TEMPLATES_READ = 'workout-templates:read',
  WORKOUT_TEMPLATES_READ_TENANT = 'workout-templates:read-tenant',
  WORKOUT_TEMPLATES_READ_ALL = 'workout-templates:read-all',
  WORKOUT_TEMPLATES_CREATE = 'workout-templates:create',
  WORKOUT_TEMPLATES_UPDATE = 'workout-templates:update',
  WORKOUT_TEMPLATES_UPDATE_TENANT = 'workout-templates:update-tenant',
  WORKOUT_TEMPLATES_UPDATE_ALL = 'workout-templates:update-all',
  WORKOUT_TEMPLATES_DELETE = 'workout-templates:delete',
  WORKOUT_TEMPLATES_DELETE_TENANT = 'workout-templates:delete-tenant',
  WORKOUT_TEMPLATES_DELETE_ALL = 'workout-templates:delete-all',

  // Exercícios
  EXERCISES_READ = 'exercises:read',
  EXERCISES_CREATE = 'exercises:create',
  EXERCISES_UPDATE = 'exercises:update',
  EXERCISES_DELETE = 'exercises:delete',
}
