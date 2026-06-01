import { test } from '@japa/runner'
import mail from '@adonisjs/mail/services/main'

test.group('Mail config | default mailer (Resend)', (group) => {
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('envoie un email via le mailer par défaut', async () => {
    const fake = mail.fake()
    await mail.send((message) => {
      message
        .to('test@example.com')
        .subject('Email de test')
        .html('<p>Hello Anta</p>')
    })

    fake.messages.assertSent({
      to: 'test@example.com',
      subject: 'Email de test',
    })
    fake.messages.assertSentCount(1)
  })

  test('utilise le from global configuré', async () => {
    const fake = mail.fake()
    await mail.send((message) => {
      message.to('user@example.com').subject('From global').html('<p>Test</p>')
    })

    fake.messages.assertSent((message) => {
      message.assertFrom('noreply@mg.anta.community', 'Anta')
      return true
    })
  })
})

test.group('Mail config | mailer alternatif (Mailgun)', (group) => {
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('envoie via mail.use("mailgun") sans modifier le code métier', async () => {
    const fake = mail.fake()
    await mail.use('mailgun').send((message) => {
      message
        .to('test@example.com')
        .subject('Via Mailgun')
        .html('<p>Sent through Mailgun</p>')
    })

    fake.messages.assertSent({
      to: 'test@example.com',
      subject: 'Via Mailgun',
    })
  })
})

test.group('Mail config | templates Edge', (group) => {
  group.each.setup(() => {
    mail.fake()
    return () => mail.restore()
  })

  test('rend un template Edge avec variables interpolées', async () => {
    const fake = mail.fake()
    await mail.send((message) => {
      message
        .to('test@example.com')
        .subject('Template test')
        .htmlView('emails/test_email', { message: 'Bonjour depuis Anta' })
    })

    fake.messages.assertSent((message) => {
      message.assertHtmlIncludes('Bonjour depuis Anta')
      message.assertHtmlIncludes('Anta')
      return true
    })
  })
})
