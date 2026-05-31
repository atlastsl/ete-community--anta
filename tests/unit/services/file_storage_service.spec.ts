import { test } from '@japa/runner'
import { writeFileSync, unlinkSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import drive from '@adonisjs/drive/services/main'
import FileStorageService, {
  FileValidationError,
  ALLOWED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
} from '#services/file_storage_service'

function makeFile(
  size: number,
  type: string | null,
  subtype: string | null,
  tmpPath: string = '/tmp/test-file'
) {
  return { size, type, subtype, tmpPath } as any
}

test.group('FileStorageService | validate', () => {
  test('accepts a valid PDF file', ({ assert }) => {
    const file = makeFile(1024, 'application', 'pdf')
    assert.doesNotThrow(() => FileStorageService.validate(file))
  })

  test('accepts a valid EPUB file', ({ assert }) => {
    const file = makeFile(1024, 'application', 'epub+zip')
    assert.doesNotThrow(() => FileStorageService.validate(file))
  })

  test('accepts a valid MP4 file', ({ assert }) => {
    const file = makeFile(50 * 1024 * 1024, 'video', 'mp4')
    assert.doesNotThrow(() => FileStorageService.validate(file))
  })

  test('accepts a valid MP3 file', ({ assert }) => {
    const file = makeFile(10 * 1024 * 1024, 'audio', 'mpeg')
    assert.doesNotThrow(() => FileStorageService.validate(file))
  })

  test('accepts a valid AAC file', ({ assert }) => {
    const file = makeFile(5 * 1024 * 1024, 'audio', 'aac')
    assert.doesNotThrow(() => FileStorageService.validate(file))
  })

  test('accepts a file exactly at 100 Mo', ({ assert }) => {
    const file = makeFile(MAX_FILE_SIZE_BYTES, 'application', 'pdf')
    assert.doesNotThrow(() => FileStorageService.validate(file))
  })

  test('rejects a file exceeding 100 Mo', ({ assert }) => {
    const file = makeFile(MAX_FILE_SIZE_BYTES + 1, 'application', 'pdf')
    try {
      FileStorageService.validate(file)
      assert.fail('Expected FileValidationError')
    } catch (error) {
      assert.instanceOf(error, FileValidationError)
      assert.include((error as FileValidationError).message, 'trop volumineux')
    }
  })

  test('rejects an unauthorized MIME type', ({ assert }) => {
    const file = makeFile(1024, 'image', 'jpeg')
    try {
      FileStorageService.validate(file)
      assert.fail('Expected FileValidationError')
    } catch (error) {
      assert.instanceOf(error, FileValidationError)
      assert.include((error as FileValidationError).message, 'non autorisé')
    }
  })

  test('rejects a file with no type', ({ assert }) => {
    const file = makeFile(1024, null, null)
    try {
      FileStorageService.validate(file)
      assert.fail('Expected FileValidationError')
    } catch (error) {
      assert.instanceOf(error, FileValidationError)
      assert.include((error as FileValidationError).message, 'non autorisé')
    }
  })

  test('exports the allowed MIME types list', ({ assert }) => {
    assert.isArray(ALLOWED_MIME_TYPES)
    assert.lengthOf(ALLOWED_MIME_TYPES, 5)
    assert.include([...ALLOWED_MIME_TYPES], 'application/pdf')
  })

  test('exports MAX_FILE_SIZE_BYTES as 100 Mo', ({ assert }) => {
    assert.equal(MAX_FILE_SIZE_BYTES, 100 * 1024 * 1024)
  })
})

test.group('FileStorageService | upload', (group) => {
  const testFilePath = join(tmpdir(), 'anta-test-upload.pdf')

  group.each.setup(() => {
    writeFileSync(testFilePath, 'fake pdf content')
    drive.fake('r2')
    return () => {
      drive.restore('r2')
      if (existsSync(testFilePath)) {
        unlinkSync(testFilePath)
      }
    }
  })

  test('uploads a valid file and returns the key', async ({ assert }) => {
    const file = makeFile(1024, 'application', 'pdf', testFilePath)
    const key = 'productions/abc/test.pdf'

    const result = await FileStorageService.upload(file, key)

    assert.equal(result, key)
  })

  test('rejects upload if validation fails', async ({ assert }) => {
    const file = makeFile(MAX_FILE_SIZE_BYTES + 1, 'application', 'pdf', testFilePath)

    try {
      await FileStorageService.upload(file, 'some/key')
      assert.fail('Expected FileValidationError')
    } catch (error) {
      assert.instanceOf(error, FileValidationError)
    }
  })
})

test.group('FileStorageService | signedUrl', (group) => {
  group.each.setup(() => {
    drive.fake('r2')
    return () => drive.restore('r2')
  })

  test('returns a signed URL string', async ({ assert }) => {
    const url = await FileStorageService.signedUrl('productions/abc/test.pdf')

    assert.isString(url)
    assert.isTrue(url.length > 0)
  })
})

test.group('FileStorageService | delete', (group) => {
  group.each.setup(() => {
    drive.fake('r2')
    return () => drive.restore('r2')
  })

  test('deletes a file without throwing', async ({ assert }) => {
    await assert.doesNotReject(() => FileStorageService.delete('productions/abc/test.pdf'))
  })
})
