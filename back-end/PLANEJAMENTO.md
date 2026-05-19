# Planejamento: Boilerplate de Autenticação Multi-Tenant

## Visão Geral

Sistema de autenticação multi-tenant com suporte a múltiplos contextos de usuário (organização principal, empresas clientes e usuários avulsos). Uma mesma pessoa física pode ter vínculos em mais de um contexto simultaneamente.

---

## Modelagem de Domínio

### Entidades Principais

```
Person      → representa a pessoa física (dados de identidade)
User        → vínculo de uma Person a um contexto (tenant + role)
Tenant      → empresa cliente (multi-tenant)
AuthenticationLog    → registro de tentativas de login
CriticalOperationLog → registro de operações em tabelas críticas
PasswordChangeLog    → registro de trocas de senha
```

> A **organização principal** não possui tabela própria — seria uma entidade com exatamente um registro, o que não justifica o overhead de uma FK e um join em toda consulta. Seus metadados (nome, e-mail de contato) ficam em variáveis de ambiente. Usuários da org são identificados pelo campo `context = 'organization'` na tabela `users`.

> **Roles e permissões são enums de código**, não registros de banco. O mapeamento role→permissions vive em TypeScript (`src/common/enums/`). **Um usuário pode ter N roles** — o vínculo está na tabela `user_roles`. Não existem tabelas `roles` nem `permissions` como registros dinâmicos.

### Relacionamentos

```
Person   1 — N  User
Tenant   1 — N  User      (usuários de empresas clientes)
User     1 — N  UserRole  (roles do usuário)
User     1 — N  RefreshToken
User     1 — N  AuthenticationLog
User     1 — N  CriticalOperationLog
User     1 — N  PasswordChangeLog
Tenant   1 — N  AuthenticationLog
Tenant   1 — N  CriticalOperationLog
Tenant   1 — N  PasswordChangeLog
```

> Um `User` pertence a **exatamente um** contexto: ou é da organização (`context = 'organization'`, `tenant_id = null`), ou de um Tenant (`context = 'tenant'`, `tenant_id` preenchido), ou avulso (`context = 'standalone'`, `tenant_id = null`). A `Person` é quem agrega os múltiplos vínculos.

---

## Modelo de Banco de Dados (PostgreSQL)

### Diagrama de Tabelas

```
persons
  id            UUID PK
  name          VARCHAR
  email         VARCHAR UNIQUE       ← e-mail da pessoa física
  document     CHAR(11) NOT NULL UNIQUE  ← CPF ou equivalente (11 dígitos)
  phone         VARCHAR
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

tenants
  id            UUID PK
  name          VARCHAR
  slug          VARCHAR UNIQUE
  is_active     BOOLEAN
  deleted_at    TIMESTAMP (nullable)  ← exclusão lógica
  created_at    TIMESTAMP
  updated_at    TIMESTAMP

users
  id            UUID PK
  person_id     UUID FK → persons
  tenant_id     UUID FK → tenants (nullable)
  context       VARCHAR  CHECK IN ('organization','tenant','standalone')
  password_hash VARCHAR
  is_active     BOOLEAN
  deleted_at    TIMESTAMP (nullable)  ← exclusão lógica
  last_login_at TIMESTAMP
  created_at    TIMESTAMP
  updated_at    TIMESTAMP
  -- CONSTRAINT: context='tenant' exige tenant_id não nulo
  -- CONSTRAINT: context IN ('organization','standalone') exige tenant_id nulo

user_roles
  user_id       UUID FK → users
  role          VARCHAR  CHECK IN (<valores do enum Role>)  ← enum de código
  assigned_at   TIMESTAMP
  deleted_at    TIMESTAMP (nullable)  ← revogação lógica
  PRIMARY KEY (user_id, role)

refresh_tokens
  id            UUID PK
  user_id       UUID FK → users
  token_hash    VARCHAR
  expires_at    TIMESTAMP
  revoked_at    TIMESTAMP (nullable)
  ip_address    VARCHAR
  user_agent    VARCHAR

log_context_types
  id            SMALLINT PK            ← 1 = organization, 2 = tenant, 3 = standalone
  name          VARCHAR UNIQUE         ← 'organization' | 'tenant' | 'standalone'

authentication_logs
  id            UUID PK
  tenant_id     UUID FK → tenants (nullable)  ← null quando contexto = 'organization'
  context_type_id SMALLINT FK → log_context_types
  success       BOOLEAN
  login_used    VARCHAR                ← e-mail ou identificador utilizado (sem senha)
  ip_address    VARCHAR
  created_at    TIMESTAMP

critical_operation_logs
  id            UUID PK
  tenant_id     UUID FK → tenants (nullable)  ← null quando contexto = 'organization'
  table_name    VARCHAR                ← nome da tabela alvo (ex: 'users', 'tenants')
  operation     VARCHAR  CHECK IN ('CREATE','UPDATE','DELETE','READ')
  record_id     VARCHAR                ← id do registro afetado
  user_id       UUID FK → users
  ip_address    VARCHAR
  created_at    TIMESTAMP

password_change_logs
  id            UUID PK
  tenant_id     UUID FK → tenants (nullable)  ← null quando contexto = 'organization'
  user_id       UUID FK → users
  is_session    BOOLEAN                ← true = troca com sessão ativa; false = recuperação de senha
  ip_address    VARCHAR
  created_at    TIMESTAMP
```

> Nenhuma tabela é **deletada fisicamente**. Toda remoção usa `deleted_at` (soft delete). Queries padrão filtram `deleted_at IS NULL`.

---

## Roles e Permissões do Sistema (Enums de Código)

Roles e permissões são **enums TypeScript** — não existem como tabelas dinâmicas no banco. Um usuário pode ter **N roles simultâneas**, armazenadas na tabela de junção `user_roles` (uma linha por role). O mapeamento role→permissions é um `Record` imutável definido em `src/common/enums/role-permissions.map.ts`. As permissões efetivas de um usuário são a **união** das permissões de todas as suas roles ativas.

### Enum `Role`

```typescript
export enum Role {
  // Contexto: organização principal
  ORG_ADMIN     = 'org:admin',
  ORG_SUPPORT   = 'org:support',

  // Contexto: tenant (empresa cliente)
  TENANT_ADMIN      = 'tenant:admin',
  TENANT_FINANCIAL  = 'tenant:financial',
  TENANT_ATTENDANT  = 'tenant:attendant',

  // Contexto: standalone (usuário avulso)
  STANDALONE_USER = 'standalone:user',
}
```

### Enum `Permission`

```typescript
export enum Permission {
  // Tenants
  TENANT_CREATE = 'tenant:create',
  TENANT_READ   = 'tenant:read',
  TENANT_UPDATE = 'tenant:update',
  TENANT_DELETE = 'tenant:delete',

  // Usuários
  USER_CREATE      = 'user:create',
  USER_READ        = 'user:read',
  USER_UPDATE      = 'user:update',
  USER_DELETE      = 'user:delete',
  USER_IMPERSONATE = 'user:impersonate',   // exclusivo de ORG_SUPPORT

  // Autenticação
  AUTH_LOGIN         = 'auth:login',
  AUTH_LOGOUT        = 'auth:logout',
  AUTH_REFRESH_TOKEN = 'auth:refresh-token',

  // Logs
  LOG_READ = 'log:read',

  // Financeiro (a expandir)
  FINANCIAL_INVOICES_READ   = 'financial:invoices:read',
  FINANCIAL_INVOICES_CREATE = 'financial:invoices:create',
  FINANCIAL_REPORTS_READ    = 'financial:reports:read',

  // Atendimento (a expandir)
  ATTENDANCE_TICKETS_READ   = 'attendance:tickets:read',
  ATTENDANCE_TICKETS_CREATE = 'attendance:tickets:create',
  ATTENDANCE_TICKETS_UPDATE = 'attendance:tickets:update',
}
```

### Mapa Role → Permissions

```typescript
// src/common/enums/role-permissions.map.ts
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ORG_ADMIN]: Object.values(Permission),   // todas

  [Role.ORG_SUPPORT]: [
    Permission.USER_IMPERSONATE,
    Permission.TENANT_READ,
    Permission.USER_READ,
    Permission.LOG_READ,
  ],

  [Role.TENANT_ADMIN]: [
    Permission.USER_CREATE, Permission.USER_READ,
    Permission.USER_UPDATE, Permission.USER_DELETE,
    Permission.TENANT_READ,
    Permission.FINANCIAL_INVOICES_READ,
    Permission.FINANCIAL_REPORTS_READ,
    Permission.ATTENDANCE_TICKETS_READ,
    Permission.ATTENDANCE_TICKETS_CREATE,
    Permission.ATTENDANCE_TICKETS_UPDATE,
    Permission.LOG_READ,
  ],

  [Role.TENANT_FINANCIAL]: [
    Permission.FINANCIAL_INVOICES_READ,
    Permission.FINANCIAL_INVOICES_CREATE,
    Permission.FINANCIAL_REPORTS_READ,
  ],

  [Role.TENANT_ATTENDANT]: [
    Permission.ATTENDANCE_TICKETS_READ,
    Permission.ATTENDANCE_TICKETS_CREATE,
    Permission.ATTENDANCE_TICKETS_UPDATE,
  ],

  [Role.STANDALONE_USER]: [
    Permission.AUTH_LOGIN,
    Permission.AUTH_LOGOUT,
    Permission.AUTH_REFRESH_TOKEN,
  ],
};
```

### Descrição das Roles

| Role                    | Contexto     | Descrição |
|-------------------------|--------------|----------|
| `org:admin`             | organization | Acesso total ao sistema |
| `org:support`           | organization | Impersonation em qualquer tenant |
| `tenant:admin`          | tenant       | Acesso total ao escopo do tenant |
| `tenant:financial`      | tenant       | Operações financeiras |
| `tenant:attendant`      | tenant       | Atendimento ao cliente |
| `standalone:user`       | standalone   | Usuário avulso, permissões mínimas |

---

## Sincronização do Banco na Inicialização

Ao iniciar o servidor (`onApplicationBootstrap`), um serviço `DatabaseSyncService` executa as seguintes verificações:

### 1. Verificação de roles obsoletas nos usuários

```
valid_roles = Object.values(Role)   ← valores atuais do enum

SELECT ur.user_id, ur.role, u.person_id, u.tenant_id
FROM user_roles ur
JOIN users u ON u.id = ur.user_id
WHERE ur.role NOT IN (...valid_roles)
  AND ur.deleted_at IS NULL
```

Para cada usuário encontrado:
1. Setar `user_roles.deleted_at = now()` para a linha correspondente (soft delete)
2. Inserir registro em `critical_operation_logs` (via `AuditLogService.logCriticalOperation()`):
   - `tenant_id = user.tenant_id` (null se contexto = organization)
   - `table_name = 'user_roles'`
   - `operation = 'UPDATE'`
   - `record_id = user.id`
   - `user_id = null` (ação do sistema — campo aceita null no bootstrap)
   - `ip_address = 'system'`

> Isso garante **exclusão lógica da role**: o usuário existe, seu histórico permanece, mas perde aquela role específica. Outras roles válidas que o usuário possua permanecem intactas.

### 2. Verificação de CHECK constraint no banco

Como os valores válidos de `role` são controlados por enum de código, o CHECK constraint na coluna `users.role` deve ser **recriado** se novos valores foram adicionados ao enum (via migration). O `DatabaseSyncService` apenas **loga um warning** se detectar valores no banco fora do enum — a migration deve ser criada manualmente para atualizar o constraint.

### Fluxo resumido do bootstrap

```
AppModule bootstrap
  └── DatabaseSyncService.onApplicationBootstrap()
        ├── busca users com role inválida
        ├── para cada um:
        │     ├── revoga role (soft)
        │     └── AuditLogService.logCriticalOperation() (user_id=null, ip='system')
        └── loga resumo: "X roles revogadas durante sync"
```

---

## Fluxos de Autenticação

### Login padrão
```
POST /auth/login
  body: { login, password, tenantSlug? }
        login = e-mail ou document (11 dígitos) da pessoa
  → valida person.email ou person.document + user.password_hash no contexto correto
  → retorna accessToken (JWT, curta duração) + refreshToken (longa duração, armazenado em hash)
```

### Impersonation (org:support → tenant)
```
POST /auth/impersonate
  header: Authorization: Bearer <token org:support>
  body: { tenantId, targetUserId? }
  → gera token temporário com contexto do tenant
  → registra no audit_log com flag de impersonation
```

### Refresh Token
```
POST /auth/refresh
  body: { refreshToken }
  → valida hash, verifica expiração e revogação
  → emite novo accessToken
```

### Logout
```
POST /auth/logout
  → revoga o refreshToken (seta revoked_at)
```

---

## Estrutura de Módulos NestJS

```
src/
├── main.ts
├── app.module.ts
│
├── config/                        ← variáveis de ambiente, validação com Joi
│   └── configuration.ts
│
├── common/
│   └── enums/
│       ├── role.enum.ts            ← enum Role
│       ├── permission.enum.ts      ← enum Permission
│       └── role-permissions.map.ts ← Record<Role, Permission[]>
│
├── database/                      ← TypeORM setup + migrations
│   ├── database.module.ts
│   ├── database-sync.service.ts   ← sincronização no bootstrap
│   └── migrations/
│
├── common/
│   ├── enums/                      ← (ver acima, definido junto ao database)
│   ├── decorators/
│   │   ├── current-user.decorator.ts
│   │   ├── public.decorator.ts
│   │   └── roles.decorator.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts
│   │   ├── roles.guard.ts
│   │   └── permissions.guard.ts
│   ├── filters/
│   │   └── http-exception.filter.ts
│   └── pipes/
│       └── validation.pipe.ts
│
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   └── local.strategy.ts
│   └── dto/
│       ├── login.dto.ts
│       ├── refresh-token.dto.ts
│       └── impersonate.dto.ts
│
├── persons/
│   ├── persons.module.ts
│   ├── persons.controller.ts
│   ├── persons.service.ts
│   ├── entities/person.entity.ts
│   └── dto/
│
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/user.entity.ts
│   └── dto/
│
├── tenants/
│   ├── tenants.module.ts
│   ├── tenants.controller.ts
│   ├── tenants.service.ts
│   ├── entities/tenant.entity.ts
│   └── dto/
│
│
└── audit-logs/
    ├── audit-logs.module.ts
    ├── audit-logs.controller.ts     ← consulta de logs, restrito a org:admin
    ├── audit-logs.service.ts        ← logAuthentication(), logCriticalOperation(), logPasswordChange()
    └── entities/
        ├── authentication-log.entity.ts
        ├── critical-operation-log.entity.ts
        └── password-change-log.entity.ts
```

---

## JWT — Payload

```json
{
  "sub": "<user.id>",
  "personId": "<person.id>",
  "context": "organization | tenant | standalone",
  "tenantId": "<uuid | null>",
  "roles": ["tenant:admin", "tenant:financial"],
  "impersonatedBy": "<user.id | null>",
  "iat": 1714000000,
  "exp": 1714003600
}
```

> O JWT **não carrega permissões granulares**. As permissões efetivas são calculadas em tempo de execução pelos guards a partir de `ROLE_PERMISSIONS`, tomando a união das permissões de todas as roles do array. Isso mantém o token pequeno e evita que permissões revogadas continuem válidas até a expiração do token.

> **`impersonatedBy`**: quando um usuário `org:support` acessa um tenant via impersonation, o JWT gerado representa um admin daquele tenant, mas carrega o ID do usuário de suporte como `impersonatedBy`. Qualquer ação executada com esse token é registrada no `audit_log` com o contexto de quem realmente operou — rastreabilidade completa sem depender de logs de infraestrutura.

---

## Audit Log — Estratégia de Geração

Os logs **não** são gerados por interceptor global. Toda gravação é feita por chamada explícita ao `AuditLogService` dentro dos services responsáveis pelo evento. Isso garante controle fino sobre o que é registrado e evita logs desnecessários.

### Casos de log obrigatórios

#### 1. Login (`AuditLogService.logAuthentication(dto)`)

Chamado em `AuthService.login()` — tanto em caso de sucesso quanto de falha.

| Campo             | Descrição |
|-------------------|-----------|
| `tenant_id`       | null se contexto = organization; FK para tenants caso contrário |
| `context_type_id` | FK para `log_context_types` (1=organization, 2=tenant, 3=standalone) |
| `success`         | `true` = login bem-sucedido; `false` = falha (senha errada, usuário inativo, etc.) |
| `login_used`      | identificador informado (e-mail); **nunca armazenar senha** |
| `ip_address`      | IP da requisição |

#### 2. Operações em tabelas críticas (`AuditLogService.logCriticalOperation(dto)`)

Chamado explicitamente nos services de `users`, `tenants` e qualquer entidade sensível, nas operações de criação, atualização, exclusão lógica e, quando relevante, leitura.

| Campo         | Descrição |
|---------------|-----------|
| `tenant_id`   | null se contexto = organization; FK para tenants caso contrário |
| `table_name`  | nome da tabela afetada (ex: `'users'`, `'tenants'`, `'user_roles'`) |
| `operation`   | `'CREATE'` \| `'UPDATE'` \| `'DELETE'` \| `'READ'` |
| `record_id`   | id (string) do registro afetado |
| `user_id`     | FK para o usuário que executou a ação (null apenas em operações do sistema) |
| `ip_address`  | IP da requisição ou `'system'` para operações de bootstrap |

**Tabelas críticas monitoradas:** `users`, `tenants`, `user_roles`, `persons`.

#### 3. Troca de senha (`AuditLogService.logPasswordChange(dto)`)

Chamado em `AuthService` nos fluxos de troca de senha com sessão ativa e de recuperação de senha.

| Campo        | Descrição |
|--------------|-----------|
| `tenant_id`  | null se contexto = organization; FK para tenants caso contrário |
| `user_id`    | FK para o usuário que teve a senha alterada |
| `is_session` | `true` = usuário autenticado alterou a própria senha; `false` = via fluxo de recuperação |
| `ip_address` | IP da requisição |

### Regra de `tenant_id`

> `tenant_id = null` sempre que o ator responsável pelo log for a **organização principal** (contexto `'organization'`). Para usuários de tenant ou standalone, `tenant_id` é preenchido com a FK correspondente.

---

## Stack e Dependências

| Categoria         | Tecnologia |
|-------------------|------------|
| Framework         | NestJS (Node.js) |
| Linguagem         | TypeScript |
| Banco de dados    | PostgreSQL |
| ORM               | TypeORM ou Prisma (a definir) |
| Autenticação      | Passport.js + JWT (`@nestjs/jwt`) |
| Validação         | class-validator + class-transformer |
| Hash de senha     | bcrypt |
| Variáveis de env  | @nestjs/config + Joi |
| Testes            | Jest + Supertest |
| Migrations        | TypeORM Migrations ou Prisma Migrate |
| Containerização   | Docker + Docker Compose |

---

## Etapas de Implementação

### Fase 1 — Infraestrutura Base
- [x] Configurar Docker Compose com PostgreSQL
- [x] Configurar módulo de configuração (`@nestjs/config` + validação Joi)
- [x] Integrar TypeORM e criar conexão com o banco
- [x] Definir enums `Role` e `Permission` e o mapa `ROLE_PERMISSIONS`
- [x] Criar migrations iniciais para todas as tabelas (sem `roles`/`permissions`)
- [x] Implementar `DatabaseSyncService` com lógica de revogação de roles obsoletas
- [x] Seed: criar usuário `org:admin` da organização principal
- [x] Seed: criar usuário de sistema (`sys.user@viso.dev.br`) para operações automatizadas

### Fase 2 — Autenticação
- [x] Implementar módulo `auth` com estratégias Local e JWT
- [x] Endpoint de login com resolução de contexto (org, tenant, standalone)
- [x] Emissão e validação de JWT com payload completo
- [x] Refresh token (geração, rotação e revogação)
- [x] Logout
- [x] Guard JWT global com decorator `@Public()` para rotas abertas

### Fase 3 — Autorização
- [x] Implementar `RolesGuard` e `PermissionsGuard`
- [x] Decorators `@Roles()` e `@RequirePermissions()`
- [x] Implementar fluxo de impersonation para `org:support`
- [x] Testes unitários dos guards

### Fase 4 — CRUD de Entidades
- [x] Módulo `persons`
- [x] Módulo `users` (com associação a contexto e validação de role vs context)
- [x] Módulo `tenants`
- [x] Modulo `roles` (readoly, apresentando permissões de cada role, permitida apenas para `org:admin`)

### Fase 5 — Audit Log
- [x] Criar tabela `log_context_types` com seed dos 3 valores (organization, tenant, standalone)
- [x] Criar tabelas `authentication_logs`, `critical_operation_logs` e `password_change_logs` via migration
- [x] Implementar entidades TypeORM para as três tabelas de log
- [x] Implementar `AuditLogService` com métodos:
  - `logAuthentication(dto)` — chamado em `AuthService.login()`
  - `logCriticalOperation(dto)` — chamado nos services de `users`, `tenants`, `persons`, `user_roles`
  - `logPasswordChange(dto)` — chamado em `AuthService` nos fluxos de senha
- [x] Integrar chamadas explícitas ao `AuditLogService` em cada ponto obrigatório (sem interceptor global)
- [x] Endpoint de consulta de logs (`GET /audit-logs/:type`) restrito a `org:admin`
- [x] Paginação e filtros (por tenant, usuário, período)

### Fase 6 — Testes e Documentação
- [ ] Testes unitários por módulo
- [ ] Testes E2E dos fluxos de autenticação
- [ ] Documentação Swagger (`@nestjs/swagger`)
- [ ] README com instruções de setup

---

## Segurança — Considerações

- Senhas armazenadas com `bcrypt` (custo mínimo 12)
- Refresh tokens armazenados como hash (`sha256`) no banco
- JWT com expiração curta (ex: 15 minutos); refresh token com expiração longa (ex: 7 dias)
- Rate limiting em endpoints de autenticação (`@nestjs/throttler`)
- CORS configurado por tenant/origem
- Redigir campos sensíveis nos logs antes de persistir
- Impersonation registrada explicitamente no audit log e no payload do JWT

---

## Variáveis de Ambiente

```env
# App
PORT=3000
NODE_ENV=development

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/multitenant

# JWT
JWT_SECRET=
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=
JWT_REFRESH_EXPIRES_IN=7d

# Organização principal (sem tabela — apenas config)
ORG_NAME="Minha Empresa"
ORG_ADMIN_EMAIL=admin@system.com
ORG_ADMIN_PASSWORD=

# Usuário de sistema (operações automatizadas do bootstrap)
# Gerar com: openssl rand -hex 32
SYS_USER_PASSWORD=
```
