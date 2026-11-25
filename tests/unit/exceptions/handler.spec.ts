import { test } from '@japa/runner'
import HttpExceptionHandler from '#exceptions/handler'

// Revue 10.1 : la page 404 est rendue partout ; la page 5xx reste réservée à la production
// (hors production, Youch garde la pile d'appels).
test.group('HttpExceptionHandler | status pages', () => {
  test('404 rendue hors production, 5xx non', ({ assert }) => {
    const handler = new HttpExceptionHandler() as unknown as {
      renderStatusPages: boolean
      statusPages: Record<string, unknown>
    }
    assert.isTrue(handler.renderStatusPages)
    assert.deepEqual(Object.keys(handler.statusPages), ['404'])
  })
})
