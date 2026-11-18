import { existsSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BaseCommand, flags } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * `authors:propose` (Story 9.5, P2.2): writes the proposed conversion table of the
 * free-text author names. Read-only on the database; the CSV must stay under `tmp/`
 * (git-ignored, contains real names: never committed).
 */
export default class AuthorsPropose extends BaseCommand {
  static commandName = 'authors:propose'
  static description =
    'Propose la table de conversion des noms d’auteurs (CSV sous tmp/, lecture seule)'
  static options: CommandOptions = { startApp: true }

  @flags.string({
    description: 'Fichier CSV à écrire (sous tmp/)',
    default: 'tmp/authors-conversion.csv',
  })
  declare out: string

  @flags.boolean({ description: 'Écraser le fichier s’il existe déjà' })
  declare force: boolean

  /** Absolute path of `out` when it lies inside `tmp/`, otherwise null. */
  private resolveOut(): string | null {
    const target = path.isAbsolute(this.out) ? this.out : this.app.makePath(this.out)
    const relative = path.relative(this.app.makePath('tmp'), target)
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) return null
    return target
  }

  async run() {
    // Lazy import: Ace loads every command module for its metadata before the app
    // boots (providers not registered yet, e.g. `vine.file` used by the validators).
    const { default: AuthorConversionService } = await import('#services/author_conversion_service')
    const target = this.resolveOut()
    if (!target) {
      this.logger.error(`--out doit désigner un fichier sous tmp/ (reçu : ${this.out})`)
      this.exitCode = 1
      return
    }
    if (existsSync(target) && !this.force) {
      this.logger.error(`${this.out} existe déjà : relancer avec --force pour l’écraser`)
      this.exitCode = 1
      return
    }

    const { rows, summary } = await AuthorConversionService.propose()
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, AuthorConversionService.toCsv(rows), 'utf8')

    this.logger.success(`Proposition écrite : ${this.out} (${rows.length} ligne(s))`)
    this.logger.info(
      `Noms à rattacher : ${summary.sourceNames} · groupes : ${summary.groups} · ` +
        `exact : ${summary.exact} · grouped : ${summary.grouped} · fuzzy : ${summary.fuzzy}`
    )
    this.logger.info(
      `Fiches existantes proposées : ${summary.existingAuthors} · occurrences déjà rattachées : ` +
        `${summary.attached} · noms vides ignorés : ${summary.blank}`
    )
    this.logger.info('Aucune écriture en base. Ne jamais commiter ni joindre ce CSV à une PR.')
  }
}
