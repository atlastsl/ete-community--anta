import env from '#start/env'
import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: 'r2',

  services: {
    r2: services.s3({
      credentials: {
        accessKeyId: env.get('R2_ACCESS_KEY_ID'),
        // .release() : R2_SECRET_ACCESS_KEY est un secret() — déballer en string
        // pour le driver S3 (sinon l'AWS SDK reçoit un objet Secret).
        secretAccessKey: env.get('R2_SECRET_ACCESS_KEY').release(),
      },
      region: 'auto',
      bucket: env.get('R2_BUCKET'),
      endpoint: env.get('R2_ENDPOINT'),
      visibility: 'private',
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
