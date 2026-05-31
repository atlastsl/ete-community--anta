import { BaseSeeder } from '@adonisjs/lucid/seeders'
import env from '#start/env'
import hash from '@adonisjs/core/services/hash'
import AdminUser from '#models/admin_user'

export type SuperAdminSeederResult =
  | { action: 'created'; email: string }
  | { action: 'unchanged'; email: string }
  | { action: 'password_rotated'; email: string }

export type SuperAdminSeederOverrides = {
  email?: string
  password?: string
}

/**
 * Logique réutilisable du seeder Super Admin.
 *
 * Sépare la logique métier de l'enveloppe BaseSeeder pour faciliter les tests :
 * - Les tests appellent `SuperAdminSeederLogic.run({ email, password })` directement
 * - Le seeder CLI lit les variables d'environnement et délègue
 */
export class SuperAdminSeederLogic {
  static async run(overrides: SuperAdminSeederOverrides = {}): Promise<SuperAdminSeederResult> {
    const email = overrides.email ?? env.get('SUPER_ADMIN_EMAIL')
    const password = overrides.password ?? env.get('SUPER_ADMIN_PASSWORD')

    if (!email || !password) {
      throw new Error(
        'SUPER_ADMIN_EMAIL et SUPER_ADMIN_PASSWORD doivent être définis dans .env pour exécuter SuperAdminSeeder'
      )
    }

    const existing = await AdminUser.findBy('email', email)

    if (!existing) {
      // Le mixin `withAuthFinder` du modèle hash automatiquement passwordHash
      // via un hook beforeSave — passer le password en clair, jamais pré-hasher.
      await AdminUser.create({
        email,
        passwordHash: password,
        role: 'super_admin',
        isActive: true,
        totpEnabled: false,
        passwordChanged: false,
      })
      return { action: 'created', email }
    }

    // Idempotence : ne touche au compte QUE si le mot de passe a changé.
    // Préserve volontairement is_active, totp_enabled, totp_secret — l'admin peut les avoir modifiés.
    const passwordUnchanged = await hash.verify(existing.passwordHash, password)
    if (passwordUnchanged) {
      return { action: 'unchanged', email }
    }

    existing.passwordHash = password // plain → hashé par le mixin au save
    existing.passwordChanged = false
    await existing.save()
    return { action: 'password_rotated', email }
  }
}

/**
 * Seeder CLI — exécutable via :
 *   node ace db:seed --files=./database/seeders/super_admin_seeder.ts
 */
export default class extends BaseSeeder {
  async run() {
    const result = await SuperAdminSeederLogic.run()

    switch (result.action) {
      case 'created':
        console.log(`✔ Super admin créé : ${result.email}`)
        break
      case 'unchanged':
        console.log(`✔ Super admin déjà à jour : ${result.email}`)
        break
      case 'password_rotated':
        console.log(
          `✔ Mot de passe du super admin mis à jour : ${result.email} (password_changed remis à false)`
        )
        break
    }
  }
}
