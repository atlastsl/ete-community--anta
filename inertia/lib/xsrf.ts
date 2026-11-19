/**
 * Value of the `XSRF-TOKEN` cookie written by Shield (`enableXsrfCookie: true` in
 * `config/shield.ts`), sent back as the `X-XSRF-TOKEN` header of `fetch` requests that
 * mutate (Story 9.8, NFR7). Inertia and axios do this by themselves; a plain `fetch` does not.
 * `null` when the cookie is absent (the request is then refused by Shield).
 */
export function xsrfToken(): string | null {
  if (typeof document === 'undefined') return null
  for (const part of document.cookie.split(';')) {
    const [name, ...value] = part.trim().split('=')
    if (name === 'XSRF-TOKEN') return decodeURIComponent(value.join('='))
  }
  return null
}
