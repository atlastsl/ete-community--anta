import { test } from '@japa/runner'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * Story 6.2 — lecteurs de médias. Composants React rendus côté client (`ssr: false`)
 * + frontière TS6305 (non importables dans un test serveur) → on vérifie la SOURCE
 * (pattern Node-pur du repo).
 */
function read(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf-8')
}

const mediaViewer = read('inertia/components/public/MediaViewer.tsx')
const pdfViewer = read('inertia/components/public/PdfViewer.tsx')
const productionPage = read('inertia/pages/production.tsx')

test.group('MediaViewer | dispatch par type MIME', () => {
  test('gère les 5 formats whitelistés', ({ assert }) => {
    assert.include(mediaViewer, 'application/pdf')
    assert.include(mediaViewer, 'video/mp4')
    assert.include(mediaViewer, 'audio/mpeg')
    assert.include(mediaViewer, 'audio/aac')
    // EPUB passe par le repli (bouton "Ouvrir") — présent via FORMAT_LABELS
    assert.include(mediaViewer, 'application/epub+zip')
  })

  test('PDF -> PdfViewer ; vidéo/audio -> éléments natifs', ({ assert }) => {
    assert.include(mediaViewer, 'PdfViewer')
    assert.include(mediaViewer, '<video controls')
    assert.include(mediaViewer, '<audio controls')
  })

  test('repli EPUB/inconnu : lien externe sécurisé', ({ assert }) => {
    assert.include(mediaViewer, 'target="_blank"')
    assert.include(mediaViewer, 'rel="noopener noreferrer"')
    assert.include(mediaViewer, 'media.open_document')
  })

  test('repli si URL indisponible (NFR12)', ({ assert }) => {
    assert.include(mediaViewer, 'media.unavailable')
    assert.include(mediaViewer, 'if (!url)')
  })
})

test.group('PdfViewer | iframe natif', () => {
  test('iframe avec title accessible, sans sandbox', ({ assert }) => {
    assert.include(pdfViewer, '<iframe')
    assert.include(pdfViewer, 'media.pdf_viewer_title')
    assert.notInclude(pdfViewer, 'sandbox=')
  })
})

test.group('MediaViewer | bouton télécharger (6.3)', () => {
  test('bouton Télécharger pointant sur downloadUrl + callback optimiste', ({ assert }) => {
    assert.include(mediaViewer, 'media.download')
    assert.include(mediaViewer, 'downloadUrl')
    assert.include(mediaViewer, 'onDownload')
  })
})

test.group('Page détail | liens externes (6.3)', () => {
  test('embed → iframe sandboxé et sans referrer', ({ assert }) => {
    assert.include(productionPage, "linkType === 'embed'")
    assert.include(productionPage, 'sandbox=')
    assert.include(productionPage, 'referrerPolicy="no-referrer"')
  })

  test('lien simple → nouvel onglet sécurisé', ({ assert }) => {
    assert.include(productionPage, 'target="_blank"')
    assert.include(productionPage, 'rel="noopener noreferrer"')
  })
})
