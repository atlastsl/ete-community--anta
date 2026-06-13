export type NativeShareData = {
  title?: string
  text?: string
  url?: string
}

export function buildShareClipboardText(intro: string, url: string): string {
  return `${intro}\n${url}`
}

function canShareData(data: NativeShareData): boolean {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') {
    return true
  }
  try {
    return navigator.canShare(data)
  } catch {
    return false
  }
}

/**
 * Choisit le payload Web Share.
 * Quand `url` est présent, le texte ne doit pas contenir l'URL : Copilot et d'autres
 * cibles concatènent `text` + `url`, ce qui dupliquerait le lien.
 */
export function pickNativeShareData(title: string, intro: string, url: string): NativeShareData {
  const body = buildShareClipboardText(intro, url)
  const candidates: NativeShareData[] = [
    { title, text: intro, url },
    { title, url },
    { title, text: body },
  ]

  for (const data of candidates) {
    if (canShareData(data)) return data
  }

  return { title, text: intro, url }
}
