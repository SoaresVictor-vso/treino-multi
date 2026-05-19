import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),

  DATABASE_HOST: Joi.string().required(),
  DATABASE_PORT: Joi.number().default(5432),
  DATABASE_USER: Joi.string().required(),
  DATABASE_PASSWORD: Joi.string().required(),
  DATABASE_NAME: Joi.string().required(),

  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  JWT_REFRESH_SECRET: Joi.string().required(),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  PASSWORD_RESET_SECRET: Joi.string().required(),

  ORG_NAME: Joi.string().required(),
  ORG_ADMIN_EMAIL: Joi.string().email().required(),
  ORG_ADMIN_PASSWORD: Joi.string().min(8).required(),

  // Usado apenas durante o seed — não obrigatório em runtime
  SYS_USER_PASSWORD: Joi.string().optional(),
});

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV,
  database: {
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    name: process.env.DATABASE_NAME,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN,
    passwordResetSecret: process.env.PASSWORD_RESET_SECRET,
  },
  org: {
    name: process.env.ORG_NAME,
    adminEmail: process.env.ORG_ADMIN_EMAIL,
    adminPassword: process.env.ORG_ADMIN_PASSWORD,
  },
});
