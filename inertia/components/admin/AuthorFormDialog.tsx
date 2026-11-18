import { type FormEvent, type RefObject, useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, XIcon } from 'lucide-react'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import AuthorForm from '~/components/admin/AuthorForm'
import { urlFor } from '~/client'
import { xsrfToken } from '~/lib/xsrf'
import {
  EMPTY_AUTHOR_FORM,
  type AuthorFormData,
  splitAuthorQuery,
  toAuthorFormData,
  toAuthorPayload,
  validateAuthorForm,
} from '~/lib/author_form'
import type { PickerAuthor } from '~/lib/author_picker'

type Props = {
  open: boolean
  /** Picker query used to prefill the names (D36); empty → empty fields. */
  initialQuery: string
  onOpenChange: (open: boolean) => void
  /** Called with the created card (picker shape) before the window closes. */
  onCreated: (author: PickerAuthor) => void
  /** Called once the window is closed and the focus restored (announcements go there). */
  onClosed?: () => void
  /** Element focused when the window closes (the trigger, or the search input after a creation). */
  returnFocusRef: RefObject<HTMLElement | null>
}

type ValidationMessage = { field: string; message: string }

/** Error keys shown under a field of `AuthorForm`; any other key also gets the generic alert. */
const DISPLAYED_ERROR =
  /^(?:lastNames|firstNames|affiliations|googleScholarUrl|photo|consent|affiliations\.\d+\.(?:institution|department))$/

/**
 * Responses meaning the session (or its CSRF secret) is gone: with `redirect: 'manual'`, the
 * login / Shield redirect is an `opaqueredirect` of status 0; 401, 403 and 419 likewise.
 */
function isSessionFailure(response: Response): boolean {
  return (
    response.type === 'opaqueredirect' ||
    response.status === 0 ||
    response.status === 401 ||
    response.status === 403 ||
    response.status === 419
  )
}

/**
 * « Create an author » window of the production form (Story 9.8, FR54, D16, mockup
 * `admin-author-picker.html`): the `AuthorForm` fields in a shadcn `Dialog` (focus trapped by
 * Radix), prefilled from the picker query. « Create and add » sends a multipart `fetch` to
 * `admin.authors.quick-store` (`X-XSRF-TOKEN`, `Accept: application/json`): never an Inertia
 * visit, so the unsaved production form is kept. 422 errors are shown under their fields;
 * any other failure gives a generic alert. The window cannot be closed while sending, nor by
 * a click outside (typed data protected); Escape, « Cancel » and × close it.
 */
export default function AuthorFormDialog({
  open,
  initialQuery,
  onOpenChange,
  onCreated,
  onClosed,
  returnFocusRef,
}: Props) {
  const { t } = useTranslation()
  const [data, setFormData] = useState<AuthorFormData>(EMPTY_AUTHOR_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [failure, setFailure] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  // A second click before the re-render would send a second POST (two cards).
  const inFlight = useRef(false)
  const content = useRef<HTMLDivElement>(null)
  // Each opening starts from the query of that opening.
  const [shownOpen, setShownOpen] = useState(false)
  if (open !== shownOpen) {
    setShownOpen(open)
    if (open) {
      setFormData({ ...EMPTY_AUTHOR_FORM, ...splitAuthorQuery(initialQuery) })
      setErrors({})
      setFailure(null)
    }
  }

  const setData = useCallback(
    <K extends keyof AuthorFormData>(key: K, value: AuthorFormData[K]) =>
      setFormData((previous) => ({ ...previous, [key]: value })),
    []
  )

  function requestClose(next: boolean) {
    if (!next && inFlight.current) return
    onOpenChange(next)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    // Portal: the React submit event would otherwise reach the production <form>.
    event.stopPropagation()
    if (inFlight.current) return

    setFailure(null)
    const clientErrors = validateAuthorForm(data, { requireAffiliation: true })
    setErrors(clientErrors)
    if (Object.keys(clientErrors).length > 0) return

    inFlight.current = true
    setSubmitting(true)
    try {
      const token = xsrfToken()
      const response = await fetch(urlFor('admin.authors.quick-store'), {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          ...(token ? { 'X-XSRF-TOKEN': token } : {}),
        },
        body: toAuthorFormData(toAuthorPayload(data)),
        credentials: 'same-origin',
        // Expired session: the login redirect is a failure, never a page to parse.
        redirect: 'manual',
      })
      if (response.status === 422) {
        const body = (await response.json()) as { errors?: ValidationMessage[] }
        const serverErrors: Record<string, string> = {}
        for (const error of body.errors ?? []) {
          serverErrors[error.field] ??= error.message
        }
        setErrors(serverErrors)
        const keys = Object.keys(serverErrors)
        if (keys.length === 0 || keys.some((key) => !DISPLAYED_ERROR.test(key))) {
          setFailure(t('authors.dialog.error'))
        }
        return
      }
      if (isSessionFailure(response)) {
        setFailure(t('authors.dialog.session_expired'))
        return
      }
      if (response.status !== 201) throw new Error(`quick_store_failed_${response.status}`)
      const body = (await response.json()) as { author: PickerAuthor }
      onCreated(body.author)
      onOpenChange(false)
    } catch {
      setFailure(t('authors.dialog.error'))
    } finally {
      inFlight.current = false
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={requestClose}>
      <DialogContent
        ref={content}
        showCloseButton={false}
        className="max-h-[90vh] overflow-y-auto sm:max-w-lg"
        onInteractOutside={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          if (inFlight.current) event.preventDefault()
        }}
        onOpenAutoFocus={(event) => {
          // First field (« Last name(s) »), not the × button.
          event.preventDefault()
          content.current?.querySelector<HTMLElement>('form input:not([type="hidden"])')?.focus()
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocusRef.current?.focus()
          onClosed?.()
        }}
      >
        <DialogHeader>
          <DialogTitle>{t('authors.create_button')}</DialogTitle>
          <DialogDescription>{t('authors.dialog.description')}</DialogDescription>
        </DialogHeader>
        <button
          type="button"
          onClick={() => requestClose(false)}
          disabled={submitting}
          aria-label={t('authors.dialog.close')}
          className="absolute right-4 top-4 rounded-xs text-stone-500 opacity-70 hover:opacity-100 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </button>

        <form onSubmit={handleSubmit} noValidate>
          <AuthorForm data={data} setData={setData} errors={errors} requireAffiliation />
          {failure && (
            <p role="alert" className="mt-4 text-sm text-red-600">
              {failure}
            </p>
          )}
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => requestClose(false)}
              disabled={submitting}
            >
              {t('actions.cancel')}
            </Button>
            <Button type="submit" disabled={submitting} aria-busy={submitting}>
              {submitting && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {t('authors.dialog.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
