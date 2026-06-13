import { router } from '@inertiajs/react'

export type PendingProductionLink = {
  url: string
  linkType: 'embed' | 'simple'
  label: string
}

function uploadFile(productionId: string, file: File): Promise<void> {
  return new Promise((resolve, reject) => {
    router.post(
      `/admin/productions/${productionId}/files`,
      { file },
      {
        forceFormData: true,
        preserveScroll: true,
        preserveState: true,
        onSuccess: () => resolve(),
        onError: () => reject(new Error('file_upload_failed')),
      }
    )
  })
}

function createLink(productionId: string, link: PendingProductionLink): Promise<void> {
  return new Promise((resolve, reject) => {
    router.post(`/admin/productions/${productionId}/links`, link, {
      preserveScroll: true,
      preserveState: true,
      onSuccess: () => resolve(),
      onError: () => reject(new Error('link_create_failed')),
    })
  })
}

/** Envoie fichiers et liens en attente après création de la production. */
export async function uploadPendingAttachments(
  productionId: string,
  pendingFiles: File[],
  pendingLinks: PendingProductionLink[]
): Promise<void> {
  for (const file of pendingFiles) {
    await uploadFile(productionId, file)
  }
  for (const link of pendingLinks) {
    await createLink(productionId, link)
  }
}

export function publishProduction(productionId: string): Promise<void> {
  return new Promise((resolve, reject) => {
    router.post(
      `/admin/productions/${productionId}/publish`,
      {},
      {
        preserveScroll: true,
        onSuccess: () => resolve(),
        onError: () => reject(new Error('publish_failed')),
      }
    )
  })
}

/** Extrait l'id production des props Inertia après redirect vers Edit. */
export function productionIdFromEditPage(props: Record<string, unknown>): string | null {
  const production = props.production as { id?: string } | undefined
  return production?.id ?? null
}
