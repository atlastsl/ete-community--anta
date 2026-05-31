import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig } from '@adonisjs/lucid'

const dbConfig = defineConfig({
  /**
   * Default connection used for all queries.
   */
  connection: 'pg',

  connections: {
    /**
     * PostgreSQL connection.
     */
    pg: {
      client: 'pg',

      connection: {
        host: env.get('DB_HOST'),
        port: env.get('DB_PORT'),
        user: env.get('DB_USER'),
        password: env.get('DB_PASSWORD', ''),
        database: env.get('DB_DATABASE'),
        // SSL requis par le pooler Supabase (DB_SSL=true), désactivé en CI/local
        // sur un PostgreSQL sans SSL (DB_SSL absent → false).
        ssl: env.get('DB_SSL') ? { rejectUnauthorized: false } : false,
      },

      migrations: {
        /**
         * Sort migration files naturally by filename.
         */
        naturalSort: true,

        /**
         * Paths containing migration files.
         */
        paths: ['database/migrations'],
      },

      debug: app.inDev,
    },
  },
})

export default dbConfig
