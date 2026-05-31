/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  // Node
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),

  // App
  APP_KEY: Env.schema.secret(),
  APP_URL: Env.schema.string({ format: 'url', tld: false }),

  // Database
  DB_HOST: Env.schema.string({ format: 'host' }),
  DB_PORT: Env.schema.number(),
  DB_USER: Env.schema.string(),
  DB_PASSWORD: Env.schema.string.optional(),
  DB_DATABASE: Env.schema.string(),
  // SSL : true pour le pooler Supabase, absent/false en CI ou PostgreSQL local sans SSL
  DB_SSL: Env.schema.boolean.optional(),

  // Session
  SESSION_DRIVER: Env.schema.enum(['cookie', 'memory', 'database'] as const),

  // Cloudflare R2
  R2_ENDPOINT: Env.schema.string({ format: 'url', tld: false }),
  R2_BUCKET: Env.schema.string(),
  R2_ACCESS_KEY_ID: Env.schema.string(),
  R2_SECRET_ACCESS_KEY: Env.schema.secret(),

  /*
  |----------------------------------------------------------
  | Variables for configuring the mail package
  |----------------------------------------------------------
  */
  MAIL_MAILER: Env.schema.enum(['resend', 'mailgun'] as const),
  MAIL_FROM_NAME: Env.schema.string(),
  MAIL_FROM_ADDRESS: Env.schema.string(),
  // Clés API optionnelles (seul le provider sélectionné par MAIL_MAILER est requis
  // au runtime) + secret() pour éviter toute fuite dans les logs / page d'exception.
  RESEND_API_KEY: Env.schema.secret.optional(),
  MAILGUN_API_KEY: Env.schema.secret.optional(),
  MAILGUN_DOMAIN: Env.schema.string.optional(),

  // Super Admin initial (Story 1.5) — requis uniquement à l'exécution de SuperAdminSeeder
  SUPER_ADMIN_EMAIL: Env.schema.string.optional({ format: 'email' }),
  SUPER_ADMIN_PASSWORD: Env.schema.string.optional(),
})
