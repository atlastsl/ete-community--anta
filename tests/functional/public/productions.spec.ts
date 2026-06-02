import { test } from '@japa/runner'
import db from '@adonisjs/lucid/services/db'

function extractProps(body: string) {
  const match = body.match(/data-page="([^"]*)"/)
  if (!match) return null
  return JSON.parse(match[1].replace(/&quot;/g, '"')).props
}

test.group('Public productions | contrat de base', (group) => {
  group.each.setup(async () => {
    await db.beginGlobalTransaction()
    return () => db.rollbackGlobalTransaction()
  })

  test('GET /productions → 200 + props results/facets/activeFilters/pagination/q', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/productions')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.properties(props, ['results', 'facets', 'activeFilters', 'pagination', 'q'])
    assert.isNull(props.q)
  })

  test('GET /productions?q=test&category=livre reflète q + activeFilters', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/productions?q=test&category=livre')
    response.assertStatus(200)
    const props = extractProps(response.text())
    assert.equal(props.q, 'test')
    assert.deepEqual(props.activeFilters.category, ['livre'])
  })

  test('GET /productions sans paramètre → q null, filtres vides', async ({ client, assert }) => {
    const response = await client.get('/productions')
    const props = extractProps(response.text())
    assert.isNull(props.q)
    assert.deepEqual(props.activeFilters.category, [])
  })
})
