import { existsSync, statSync } from 'node:fs'
import { chmod, mkdir, writeFile } from 'node:fs/promises'
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

  async run() {
    // Lazy import: Ace loads every command module for its metadata before the app
    // boots (providers not registered yet, e.g. `vine.file` used by the validators).
    const { default: AuthorConversionService } = await import('#services/author_conversion_service')
    const target = AuthorConversionService.resolveUnderTmp(this.app.makePath(), this.out)
    if (!target) {
      this.logger.error(`--out doit désigner un fichier sous tmp/ (reçu : ${this.out})`)
      this.exitCode = 1
      return
    }
    if (existsSync(target) && statSync(target).isDirectory()) {
      this.logger.error(`${this.out} est un dossier : indiquer un fichier CSV`)
      this.exitCode = 1
      return
    }
    // Early refusal (no database work); the write itself is exclusive (`wx`).
    if (existsSync(target) && !this.force) {
      this.logger.error(`${this.out} existe déjà : relancer avec --force pour l’écraser`)
      this.exitCode = 1
      return
    }

    const { rows, summary } = await AuthorConversionService.propose()
    await mkdir(path.dirname(target), { recursive: true })
    try {
      // Real names: owner-only file; `wx` never overwrites an edited CSV (no race).
      await writeFile(target, AuthorConversionService.toCsv(rows), {
        encoding: 'utf8',
        mode: 0o600,
        flag: this.force ? 'w' : 'wx',
      })
      await chmod(target, 0o600)
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code
      if (code !== 'EEXIST' && code !== 'EISDIR') throw error
      this.logger.error(
        code === 'EEXIST'
          ? `${this.out} existe déjà : relancer avec --force pour l’écraser`
          : `${this.out} est un dossier : indiquer un fichier CSV`
      )
      this.exitCode = 1
      return
    }

    this.logger.success(`Proposition écrite : ${this.out} (${rows.length} ligne(s))`)
    this.logger.info(
      `Noms à rattacher : ${summary.sourceNames} · groupes : ${summary.groups} · ` +
        `exact : ${summary.exact} · grouped : ${summary.grouped} · fuzzy : ${summary.fuzzy}`
    )
    this.logger.info(
      `Fiches existantes proposées : ${summary.existingAuthors} · occurrences déjà rattachées : ` +
        `${summary.attached} · noms vides ignorés : ${summary.blank} · ` +
        `éléments non textuels ignorés : ${summary.nonString}`
    )
    this.logger.info('Aucune écriture en base. Ne jamais commiter ni joindre ce CSV à une PR.')
  }
}
