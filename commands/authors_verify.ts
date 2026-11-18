import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `authors:verify` (Story 9.6, P2.2): checks that every name of `productions.authors` is
 * attached to a card. Read-only; exit code 1 below 100 % or on inconsistent positions /
 * desynchronised names.
 */
export default class AuthorsVerify extends BaseCommand {
  static commandName = 'authors:verify'
  static description =
    'Vérifie le rattachement des noms d’auteurs aux fiches (lecture seule, code 1 si < 100 %)'
  static options: CommandOptions = { startApp: true }

  async run() {
    // Lazy import: see authors:apply.
    const { default: AuthorConversionService } = await import('#services/author_conversion_service')
    const report = await AuthorConversionService.verify()
    const rate = `${String(report.rate).replace('.', ',')} %`

    for (const item of report.unattached) {
      this.logger.error(
        `${item.production} : non rattaché(s) ${item.names.map((n) => `« ${n} »`).join(', ')}`
      )
    }
    for (const item of report.positions) {
      this.logger.error(
        `${item.production} : positions incohérentes (${item.positions.join(', ')})`
      )
    }
    for (const item of report.desync) {
      this.logger.error(
        `${item.production} : auteur(s) lié(s) absent(s) de productions.authors (${item.authors.join(', ')})`
      )
    }
    for (const slug of report.orphans.migrated) {
      this.logger.warning(`fiche orpheline issue de la conversion : ${slug}`)
    }

    this.logger.info(
      `Productions : ${report.productions} · noms : ${report.occurrences} · rattachés : ` +
        `${report.attached} (${rate})`
    )
    this.logger.info(
      `Productions non rattachées : ${report.unattached.length} · positions incohérentes : ` +
        `${report.positions.length} · désynchronisées : ${report.desync.length}`
    )
    this.logger.info(
      `Fiches orphelines : ${report.orphans.migrated.length} (conversion) · ` +
        `${report.orphans.panel} (panel) · noms vides ignorés : ${report.blank} · ` +
        `éléments non textuels ignorés : ${report.nonString}`
    )
    this.logger.info('Aucune écriture en base.')

    if (!report.complete) {
      this.logger.error(`Rattachement incomplet ou incohérent (${rate}) : code 1`)
      this.exitCode = 1
      return
    }
    this.logger.success(
      report.occurrences === 0 ? 'Rien à rattacher (100 %)' : `Rattachement complet : ${rate}`
    )
  }
}
