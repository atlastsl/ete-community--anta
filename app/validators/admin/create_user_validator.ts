import vine, { SimpleMessagesProvider } from '@vinejs/vine'

export const createUserValidator = vine.compile(
  vine.object({
    email: vine.string().trim().email().maxLength(254).unique({
      table: 'admin_users',
      column: 'email',
    }),
  })
)

createUserValidator.messagesProvider = new SimpleMessagesProvider({
  'email.required': 'users.errors.email_required',
  'email.email': 'users.errors.email_invalid',
  'email.maxLength': 'users.errors.email_invalid',
  'email.unique': 'users.errors.email_taken',
})
