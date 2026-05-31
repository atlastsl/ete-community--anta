import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  globals: {
    brandName: 'Anta',
  },

  mailers: {
    // Les clés sont optionnelles au niveau env (secret) : on les déballe ici avec un
    // fallback vide. Seul le provider sélectionné par MAIL_MAILER doit avoir sa clé
    // renseignée — sinon l'envoi échoue à l'exécution (pas au boot).
    resend: transports.resend({
      key: env.get('RESEND_API_KEY')?.release() ?? '',
      baseUrl: 'https://api.resend.com',
    }),

    mailgun: transports.mailgun({
      key: env.get('MAILGUN_API_KEY')?.release() ?? '',
      baseUrl: 'https://api.mailgun.net/v3',
      domain: env.get('MAILGUN_DOMAIN') ?? '',
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
