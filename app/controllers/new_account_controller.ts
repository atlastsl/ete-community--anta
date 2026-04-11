import AdminUser from '#models/admin_user'
import type { HttpContext } from '@adonisjs/core/http'

export default class NewAccountController {
  async create({ inertia }: HttpContext) {
    return inertia.render('auth/signup', {})
  }

  async store({ request, response, auth }: HttpContext) {
    const { email, password } = request.all()
    const user = await AdminUser.create({
      email,
      passwordHash: password,
      role: 'admin' as const,
    })

    await auth.use('web').login(user)
    response.redirect().toRoute('home')
  }
}
