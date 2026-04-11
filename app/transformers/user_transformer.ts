import type AdminUser from '#models/admin_user'
import { BaseTransformer } from '@adonisjs/core/transformers'

export default class UserTransformer extends BaseTransformer<AdminUser> {
  toObject() {
    return this.pick(this.resource, ['id', 'email', 'role', 'isActive', 'createdAt', 'updatedAt'])
  }
}
