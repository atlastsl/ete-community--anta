import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `authors:apply` (Story 9.6, P2.2): applies the conversion CSV validated by the product
 * owner, in one transaction (`--dry-run`: same report, rolled back). Writes a report under
 * `tmp/` (real names: never committed). No activity log entry.
 */
export default class AuthorsApply extends BaseCommand {
  static commandName = 'authors:apply'
  static description =
    'Applique la table de conversion des auteurs validée (une transaction, --dry-run pour simuler)'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Fichier CSV validé', default: 'tmp/authors-conversion.csv' })
  declare file: string

  @flags.boolean({ description: 'Simuler : rapport produit, transaction annulée' })
  declare dryRun: boolean

  @flags.string({
    description: 'Rapport à écrire (sous tmp/, défaut tmp/authors-conversion-report-<date>.txt)',
  })
  declare report?: string

  async run() {
    // Lazy import: Ace loads every command module for its metadata before the app
    // boots (providers not registered yet, e.g. `vine.file` used by the validators).
    const { default: AuthorConversionService } = await import('#services/author_conversion_service')
    const date = new Date()
    const stamp = date.toISOString().slice(0, 19).replace(/:/g, '-')
    const reportPath = this.report ?? `tmp/authors-conversion-report-${stamp}.txt`
    const target = AuthorConversionService.resolveUnderTmp(this.app.makePath(), reportPath)
    if (!target) {
      this.logger.error(`--report doit désigner un fichier sous tmp/ (reçu : ${reportPath})`)
      this.exitCode = 1
      return
    }
    if (existsSync(target)) {
      this.logger.error(`${reportPath} existe déjà : choisir un autre --report`)
      this.exitCode = 1
      return
    }

    const source = path.isAbsolute(this.file) ? this.file : this.app.makePath(this.file)
    let text: string
    try {
      text = await readFile(source, 'utf8')
    } catch {
      this.logger.error(`Fichier introuvable ou illisible : ${this.file}`)
      this.exitCode = 1
      return
    }

    const { errors, warnings, result } = await AuthorConversionService.apply(text, {
      dryRun: this.dryRun,
    })
    for (const warning of warnings) this.logger.warning(warning)
    if (!result) {
      for (const error of errors) this.logger.error(error)
      this.logger.error(`${errors.length} erreur(s) : CSV non valide, aucune écriture en base`)
      this.exitCode = 1
      return
    }

    await mkdir(path.dirname(target), { recursive: true })
    // Real names: owner-only file, never overwritten.
    await writeFile(
      target,
      AuthorConversionService.formatApplyReport(result, { file: this.file, date, warnings }),
      { encoding: 'utf8', mode: 0o600, flag: 'wx' }
    )
    await chmod(target, 0o600)

    this.logger.info(
      `Fiches créées : ${result.created.length} · fiches existantes utilisées : ${result.reused.length} · ` +
        `liens créés : ${result.links.length}`
    )
    this.logger.info(
      `Productions converties : ${result.converted.length} · ignorées (déjà rattachées) : ` +
        `${result.skipped.length} · partiellement rattachées : ${result.partial.length}`
    )
    this.logger.info(`Rapport : ${reportPath} (ne jamais le commiter)`)
    if (result.dryRun) {
      this.logger.success('Simulation terminée : transaction annulée, aucune écriture en base.')
    } else {
      this.logger.success('Conversion appliquée. Lancer ensuite : node ace authors:verify')
    }
  }
}
