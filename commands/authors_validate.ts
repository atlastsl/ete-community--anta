import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `authors:validate` (Story 9.5, P2.2): checks the conversion CSV edited by the product
 * owner and reports what `authors:apply` (Story 9.6) would create or attach.
 * Read-only; exit code 1 when the CSV has errors.
 */
export default class AuthorsValidate extends BaseCommand {
  static commandName = 'authors:validate'
  static description =
    'Contrôle la table de conversion des auteurs éditée (lecture seule, code 1 si erreur)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Fichier CSV à contrôler', default: 'tmp/authors-conversion.csv' })
  declare file: string

  async run() {
    // Lazy import: Ace loads every command module for its metadata before the app
    // boots (providers not registered yet, e.g. `vine.file` used by the validators).
    const { default: AuthorConversionService } = await import('#services/author_conversion_service')
    const source = path.isAbsolute(this.file) ? this.file : this.app.makePath(this.file)
    let text: string
    try {
      text = await readFile(source, 'utf8')
    } catch {
      this.logger.error(`Fichier introuvable ou illisible : ${this.file}`)
      this.exitCode = 1
      return
    }

    const { errors, warnings, plan } = await AuthorConversionService.validate(text)
    for (const warning of warnings) this.logger.warning(warning)
    for (const error of errors) this.logger.error(error)

    this.logger.info(
      `Rapport : ${plan.toCreate} fiche(s) à créer · ${plan.toAttach} fiche(s) existante(s) rattachée(s) · ` +
        `${plan.sourceNames} nom(s) source mappé(s) · ${plan.links} lien(s) sur ${plan.productions} production(s)`
    )
    this.logger.info('Aucune écriture en base.')

    if (errors.length > 0) {
      this.logger.error(`${errors.length} erreur(s) : CSV non valide`)
      this.exitCode = 1
      return
    }
    this.logger.success(`CSV valide (${warnings.length} avertissement(s))`)
  }
}
