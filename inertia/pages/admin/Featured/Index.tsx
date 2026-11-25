import { ReactElement, useCallback, useEffect, useId, useRef, useState } from 'react'
import { router } from '@inertiajs/react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import AdminLayout from '~/layouts/AdminLayout'
import { Button } from '~/components/ui/button'
import FeaturedSlot from '~/components/admin/FeaturedSlot'
import BannerPreview from '~/components/admin/BannerPreview'
import { urlFor } from '~/client'
import { notify } from '~/lib/notify'
import {
  FEATURED_MAX_SLOTS,
  type FeaturedItem,
  isDirty,
  isOwnVisit,
  mergeRefreshed,
  moveSlot,
  removeSlot,
  saveError,
  saveSucceeded,
  shouldConfirmLeave,
  slotIssues,
} from '~/lib/featured'

type Props = {
  /** Saved selection, by position (`FeaturedService.selection`). */
  selection: FeaturedItem[]
}

type PendingFocus = { id: string; action: 'up' | 'down' | 'remove' } | 'picker' | null

/**
 * Featured page (Story 11.4, FR47, FR50, D20, D26, D30). The slots are edited locally and
 * saved explicitly (« Save » → `PUT`): reorder (↑ ↓), remove (the following move up), pick a
 * published production in the first free slot, upload its thumbnail in place without losing
 * the unsaved slots (D20). « Save » is disabled, with its visible explanation, while a filled
 * slot lacks its required thumbnail (D26).
 *
 * Page-level lock (D-11.4-1): while a thumbnail field, the save or the slot refresh runs, the
 * other fields, the slot actions, the picker and « Save » are disabled (Inertia 2.3 cancels a
 * running sync visit when another starts). After a thumbnail change, the slot states are read
 * again through `candidates?ids[]=` (D-11.4-2). Leaving with unsaved changes asks for a
 * confirmation (Inertia navigation and tab closing), never for the page's own visits
 * (D-11.4-8). Toasts come from the page: success, persistent error (D-11.4-6).
 */
export default function AdminFeaturedIndex({ selection }: Props) {
  const { t } = useTranslation()
  const saveHelpId = useId()
  const [items, setItems] = useState<FeaturedItem[]>(selection)
  const [baseline, setBaseline] = useState<string[]>(() => selection.map((item) => item.id))
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [fieldsBusy, setFieldsBusy] = useState(0)
  const [refreshFailed, setRefreshFailed] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const pendingFocus = useRef<PendingFocus>(null)
  const pickerInput = useRef<HTMLInputElement | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const dirty = isDirty(baseline, items)
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  const issues = slotIssues(items)
  const blocked = issues.map((entry) => entry.position)
  const busy = saving || refreshing || fieldsBusy > 0
  const saveDisabled = busy || blocked.length > 0 || refreshFailed

  useEffect(() => {
    const offBefore = router.on('before', (event) => {
      const { visit } = event.detail
      // The page's own visits (save, thumbnail of a slot) by method + path (D-11.4-8).
      const ownVisit = isOwnVisit(
        { method: visit.method, pathname: visit.url.pathname },
        itemsRef.current.map((item) => item.id)
      )
      if (!shouldConfirmLeave({ dirty: dirtyRef.current, ownVisit })) return
      if (!window.confirm(t('featured.leave_confirm'))) event.preventDefault()
    })
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      offBefore()
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [t])

  // Focus kept on the moved / added slot, or brought back to the picker after a removal.
  useEffect(() => {
    const target = pendingFocus.current
    if (!target) return
    pendingFocus.current = null
    if (target === 'picker') {
      pickerInput.current?.focus()
      return
    }
    const find = (action: string) =>
      document.querySelector<HTMLButtonElement>(
        `[data-featured-id="${target.id}"][data-featured-action="${action}"]`
      )
    const button = find(target.action)
    if (button && !button.disabled) button.focus()
    else find(target.action === 'up' ? 'down' : 'up')?.focus()
  }, [items])

  function announce(text: string) {
    // A trailing NBSP alternates so that a repeated message is read again.
    setAnnouncement((previous) => (previous === text ? `${text}\u00a0` : text))
  }

  const handleFieldBusy = useCallback((fieldBusy: boolean) => {
    setFieldsBusy((count) => Math.max(0, count + (fieldBusy ? 1 : -1)))
  }, [])

  /**
   * Fresh states of the (unsaved) slots after a thumbnail change (D-11.4-2); a deleted
   * production leaves its slot. On failure: inline alert with « Retry » (D20, review 11.4).
   */
  const refresh = useCallback(async () => {
    const ids = itemsRef.current.map((item) => item.id)
    if (ids.length === 0) return
    setRefreshing(true)
    setRefreshFailed(false)
    try {
      const response = await fetch(urlFor('admin.featured.candidates', {}, { qs: { ids } }), {
        headers: { Accept: 'application/json' },
        credentials: 'same-origin',
      })
      if (!response.ok) throw new Error(`refresh_failed_${response.status}`)
      const body = (await response.json()) as { productions: FeaturedItem[] }
      setItems((current) => mergeRefreshed(current, body.productions))
    } catch {
      // Inline alert with « Retry » (D20): the slots stay, the save waits for fresh states.
      setRefreshFailed(true)
    } finally {
      setRefreshing(false)
    }
  }, [t])

  function add(item: FeaturedItem) {
    if (busy || items.length >= FEATURED_MAX_SLOTS) return
    const position = items.length + 1
    pendingFocus.current =
      position < FEATURED_MAX_SLOTS ? 'picker' : { id: item.id, action: 'remove' }
    setItems([...items, item])
    announce(t('featured.announce.added', { title: item.title, n: position }))
  }

  function move(index: number, delta: -1 | 1) {
    if (busy) return
    const item = items[index]
    pendingFocus.current = { id: item.id, action: delta < 0 ? 'up' : 'down' }
    setItems(moveSlot(items, index, delta))
    announce(t('featured.announce.moved', { title: item.title, n: index + delta + 1 }))
  }

  function remove(index: number) {
    if (busy) return
    const item = items[index]
    pendingFocus.current = 'picker'
    setItems(removeSlot(items, index))
    announce(t('featured.announce.removed', { title: item.title }))
  }

  function save() {
    if (saveDisabled) return
    const sentIds = items.map((item) => item.id)
    let succeeded = false
    let message: string | null = null
    let networkFailure = false
    const offException = router.on('exception', () => {
      networkFailure = true
    })
    router.put(
      urlFor('admin.featured.update'),
      { productionIds: sentIds },
      {
        preserveState: true,
        preserveScroll: true,
        onStart: () => setSaving(true),
        onSuccess: (page) => {
          const selection = (page.props as unknown as Partial<Props>).selection
          // Any page answer is not a success (CSRF expiry → back with the old selection,
          // session expiry → login page): only the featured page with the sent selection.
          if (!saveSucceeded({ component: page.component, sentIds, selection })) {
            message = t('featured.errors.not_saved')
            return
          }
          succeeded = true
          setItems(selection!)
          setBaseline(selection!.map((item) => item.id))
        },
        onError: (errors) => {
          const { key, position } = saveError(errors, 'featured.errors.storage')
          const fallback = t(key, { defaultValue: t('featured.errors.storage') })
          message =
            position === null ? fallback : t(`${key}_slot`, { n: position, defaultValue: fallback })
        },
        onFinish: () => {
          offException()
          setSaving(false)
          if (succeeded) {
            notify.success(t('featured.saved'))
          } else {
            notify.error(
              message ?? t(networkFailure ? 'featured.errors.network' : 'featured.errors.storage')
            )
          }
        },
      }
    )
  }

  const ids = items.map((item) => item.id)

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-stone-900">{t('featured.heading')}</h1>
          <p className="mt-1 max-w-2xl text-sm text-stone-600">{t('featured.intro')}</p>
        </div>
        <span className="shrink-0 rounded-full bg-stone-100 px-3 py-1 text-sm text-stone-700">
          {t('featured.count', { count: items.length })}
        </span>
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <section className="mt-8" aria-labelledby="featured-slots-heading">
        <h2 id="featured-slots-heading" className="mb-3 font-display text-lg text-stone-900">
          {t('featured.slots_heading')}
        </h2>
        <ol className="space-y-3">
          {Array.from({ length: FEATURED_MAX_SLOTS }, (_, index) => {
            const item = items[index] ?? null
            return (
              <FeaturedSlot
                key={item ? item.id : `free-${index}`}
                position={index + 1}
                item={item}
                withPicker={index === items.length}
                excludeIds={ids}
                onSelect={add}
                pickerInputRef={pickerInput}
                canMoveUp={index > 0}
                canMoveDown={index < items.length - 1}
                onMoveUp={() => move(index, -1)}
                onMoveDown={() => move(index, 1)}
                onRemove={() => remove(index)}
                disabled={busy}
                onBusyChange={handleFieldBusy}
                onThumbnailChange={refresh}
              />
            )
          })}
        </ol>

        {refreshFailed && (
          <div
            role="alert"
            className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"
          >
            <span>{t('featured.errors.refresh')}</span>
            <Button type="button" variant="outline" size="sm" onClick={refresh} disabled={busy}>
              {t('featured.retry')}
            </Button>
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-stone-200 pt-4">
          {blocked.length > 0 ? (
            <p id={saveHelpId} className="text-sm text-amber-900">
              {issues[0].issue === 'unavailable'
                ? t('featured.save_blocked_unavailable', { n: issues[0].position })
                : t('featured.save_blocked', { n: issues[0].position })}
            </p>
          ) : refreshFailed ? (
            <p id={saveHelpId} className="text-sm text-amber-900">
              {t('featured.save_blocked_refresh')}
            </p>
          ) : (
            dirty && <p className="text-sm text-stone-600">{t('featured.unsaved')}</p>
          )}
          <Button
            type="button"
            onClick={save}
            disabled={saveDisabled}
            aria-describedby={blocked.length > 0 || refreshFailed ? saveHelpId : undefined}
          >
            {saving && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {saving ? t('featured.saving') : t('featured.save')}
          </Button>
        </div>
      </section>

      <BannerPreview items={items} />
    </div>
  )
}

AdminFeaturedIndex.layout = (page: ReactElement) => <AdminLayout>{page}</AdminLayout>
