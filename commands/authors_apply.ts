import { existsSync } from 'node:fs'
import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `authors:apply` (Story 9.6, P2.2): applies the conversion CSV validated by the product
 * owner, in one transaction (`--dry-run`: same report, rolled back). The report (real
 * names: under `tmp/`, never committed) is written before the commit: if it cannot be
 * written, nothing is committed. No activity log entry.
 *
 * Exit code: 1 when nothing was committed (invalid CSV, report not written, concurrent
 * change); 0 once committed, even when productions were left as they were (partially
 * attached, non-text values, desynchronised, anomalies): a warning then asks to run
 * `authors:verify`, whose exit code is the completeness gate.
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

    const { errors, warnings, result, reportWritten } = await AuthorConversionService.apply(text, {
      dryRun: this.dryRun,
      report: {
        file: this.file,
        date,
        write: async (report) => {
          await mkdir(path.dirname(target), { recursive: true })
          // Real names: owner-only file, never overwritten.
          await writeFile(target, report, { encoding: 'utf8', mode: 0o600, flag: 'wx' })
          await chmod(target, 0o600)
        },
      },
    })
    for (const warning of warnings) this.logger.warning(warning)
    if (!result) {
      // A report written before a failed commit would describe changes that never happened.
      if (reportWritten) await rm(target, { force: true })
      for (const error of errors) this.logger.error(error)
      this.logger.error(`${errors.length} erreur(s) : aucune écriture en base`)
      this.exitCode = 1
      return
    }

    this.logger.info(
      `Fiches créées : ${result.created.length} · fiches existantes utilisées : ${result.reused.length} · ` +
        `liens créés : ${result.links.length}`
    )
    this.logger.info(
      `Productions examinées : ${result.productions} · converties : ${result.converted.length} · ` +
        `réordonnées : ${result.reordered.length} · ignorées (déjà rattachées) : ` +
        `${result.skipped.length} · ignorées (aucun nom exploitable) : ${result.empty.length}`
    )
    const leftAside =
      result.partial.length + result.nonText.length + result.desync.length + result.anomalies.length
    if (leftAside > 0) {
      this.logger.warning(
        `${leftAside} production(s) laissée(s) en l'état (partiellement rattachées : ` +
          `${result.partial.length} · valeurs non textuelles conservées : ${result.nonText.length} · ` +
          `désynchronisées : ${result.desync.length} · anomalies : ${result.anomalies.length}) : ` +
          `voir le rapport et lancer node ace authors:verify (code de sortie 0 : ` +
          `${result.dryRun ? 'simulation' : 'conversion validée'})`
      )
    }
    this.logger.info(`Rapport : ${reportPath} (ne jamais le commiter)`)
    if (result.dryRun) {
      this.logger.success('Simulation terminée : transaction annulée, aucune écriture en base.')
    } else {
      this.logger.success('Conversion appliquée. Lancer ensuite : node ace authors:verify')
    }
  }
}
