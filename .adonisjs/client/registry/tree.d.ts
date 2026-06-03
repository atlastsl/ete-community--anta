/* eslint-disable prettier/prettier */
import type { routes } from './index.ts'

export interface ApiDefinition {
  home: typeof routes['home']
  productions: typeof routes['productions']
  production: {
    show: typeof routes['production.show']
    download: typeof routes['production.download']
  }
  privacyPolicy: typeof routes['privacy-policy']
  stats: {
    view: typeof routes['stats.view']
  }
  newAccount: {
    create: typeof routes['new_account.create']
    store: typeof routes['new_account.store']
  }
  session: {
    create: typeof routes['session.create']
    store: typeof routes['session.store']
    destroy: typeof routes['session.destroy']
  }
  admin: {
    login: typeof routes['admin.login'] & {
      submit: typeof routes['admin.login.submit']
    }
    logout: typeof routes['admin.logout']
    auth: {
      changePassword: typeof routes['admin.auth.change-password'] & {
        submit: typeof routes['admin.auth.change-password.submit']
      }
    }
    productions: typeof routes['admin.productions'] & {
      create: typeof routes['admin.productions.create']
      edit: typeof routes['admin.productions.edit']
      update: typeof routes['admin.productions.update']
      destroy: typeof routes['admin.productions.destroy']
      unpublish: typeof routes['admin.productions.unpublish']
      store: typeof routes['admin.productions.store']
      publish: typeof routes['admin.productions.publish']
      files: {
        store: typeof routes['admin.productions.files.store']
        destroy: typeof routes['admin.productions.files.destroy']
      }
      links: {
        store: typeof routes['admin.productions.links.store']
        destroy: typeof routes['admin.productions.links.destroy']
      }
    }
    stats: typeof routes['admin.stats']
    users: typeof routes['admin.users'] & {
      create: typeof routes['admin.users.create']
      store: typeof routes['admin.users.store']
      toggleActive: typeof routes['admin.users.toggle-active']
      resetPassword: typeof routes['admin.users.reset-password']
      destroy: typeof routes['admin.users.destroy']
    }
    activity: typeof routes['admin.activity']
  }
}
