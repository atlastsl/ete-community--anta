/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'productions': {
    methods: ["GET","HEAD"],
    pattern: '/productions',
    tokens: [{"old":"/productions","type":0,"val":"productions","end":""}],
    types: placeholder as Registry['productions']['types'],
  },
  'production.show': {
    methods: ["GET","HEAD"],
    pattern: '/productions/:slug',
    tokens: [{"old":"/productions/:slug","type":0,"val":"productions","end":""},{"old":"/productions/:slug","type":1,"val":"slug","end":""}],
    types: placeholder as Registry['production.show']['types'],
  },
  'production.download': {
    methods: ["GET","HEAD"],
    pattern: '/productions/:slug/files/:fileId/download',
    tokens: [{"old":"/productions/:slug/files/:fileId/download","type":0,"val":"productions","end":""},{"old":"/productions/:slug/files/:fileId/download","type":1,"val":"slug","end":""},{"old":"/productions/:slug/files/:fileId/download","type":0,"val":"files","end":""},{"old":"/productions/:slug/files/:fileId/download","type":1,"val":"fileId","end":""},{"old":"/productions/:slug/files/:fileId/download","type":0,"val":"download","end":""}],
    types: placeholder as Registry['production.download']['types'],
  },
  'privacy-policy': {
    methods: ["GET","HEAD"],
    pattern: '/privacy-policy',
    tokens: [{"old":"/privacy-policy","type":0,"val":"privacy-policy","end":""}],
    types: placeholder as Registry['privacy-policy']['types'],
  },
  'stats.view': {
    methods: ["POST"],
    pattern: '/stats/view',
    tokens: [{"old":"/stats/view","type":0,"val":"stats","end":""},{"old":"/stats/view","type":0,"val":"view","end":""}],
    types: placeholder as Registry['stats.view']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'admin.login': {
    methods: ["GET","HEAD"],
    pattern: '/admin/login',
    tokens: [{"old":"/admin/login","type":0,"val":"admin","end":""},{"old":"/admin/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['admin.login']['types'],
  },
  'admin.login.submit': {
    methods: ["POST"],
    pattern: '/admin/login',
    tokens: [{"old":"/admin/login","type":0,"val":"admin","end":""},{"old":"/admin/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['admin.login.submit']['types'],
  },
  'admin.logout': {
    methods: ["POST"],
    pattern: '/admin/logout',
    tokens: [{"old":"/admin/logout","type":0,"val":"admin","end":""},{"old":"/admin/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['admin.logout']['types'],
  },
  'admin.auth.change-password': {
    methods: ["GET","HEAD"],
    pattern: '/admin/auth/change-password',
    tokens: [{"old":"/admin/auth/change-password","type":0,"val":"admin","end":""},{"old":"/admin/auth/change-password","type":0,"val":"auth","end":""},{"old":"/admin/auth/change-password","type":0,"val":"change-password","end":""}],
    types: placeholder as Registry['admin.auth.change-password']['types'],
  },
  'admin.auth.change-password.submit': {
    methods: ["POST"],
    pattern: '/admin/auth/change-password',
    tokens: [{"old":"/admin/auth/change-password","type":0,"val":"admin","end":""},{"old":"/admin/auth/change-password","type":0,"val":"auth","end":""},{"old":"/admin/auth/change-password","type":0,"val":"change-password","end":""}],
    types: placeholder as Registry['admin.auth.change-password.submit']['types'],
  },
  'admin.productions.create': {
    methods: ["GET","HEAD"],
    pattern: '/admin/productions/create',
    tokens: [{"old":"/admin/productions/create","type":0,"val":"admin","end":""},{"old":"/admin/productions/create","type":0,"val":"productions","end":""},{"old":"/admin/productions/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['admin.productions.create']['types'],
  },
  'admin.productions.edit': {
    methods: ["GET","HEAD"],
    pattern: '/admin/productions/:id/edit',
    tokens: [{"old":"/admin/productions/:id/edit","type":0,"val":"admin","end":""},{"old":"/admin/productions/:id/edit","type":0,"val":"productions","end":""},{"old":"/admin/productions/:id/edit","type":1,"val":"id","end":""},{"old":"/admin/productions/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['admin.productions.edit']['types'],
  },
  'admin.productions': {
    methods: ["GET","HEAD"],
    pattern: '/admin/productions',
    tokens: [{"old":"/admin/productions","type":0,"val":"admin","end":""},{"old":"/admin/productions","type":0,"val":"productions","end":""}],
    types: placeholder as Registry['admin.productions']['types'],
  },
  'admin.productions.update': {
    methods: ["PUT"],
    pattern: '/admin/productions/:id',
    tokens: [{"old":"/admin/productions/:id","type":0,"val":"admin","end":""},{"old":"/admin/productions/:id","type":0,"val":"productions","end":""},{"old":"/admin/productions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.productions.update']['types'],
  },
  'admin.productions.destroy': {
    methods: ["DELETE"],
    pattern: '/admin/productions/:id',
    tokens: [{"old":"/admin/productions/:id","type":0,"val":"admin","end":""},{"old":"/admin/productions/:id","type":0,"val":"productions","end":""},{"old":"/admin/productions/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.productions.destroy']['types'],
  },
  'admin.productions.unpublish': {
    methods: ["POST"],
    pattern: '/admin/productions/:id/unpublish',
    tokens: [{"old":"/admin/productions/:id/unpublish","type":0,"val":"admin","end":""},{"old":"/admin/productions/:id/unpublish","type":0,"val":"productions","end":""},{"old":"/admin/productions/:id/unpublish","type":1,"val":"id","end":""},{"old":"/admin/productions/:id/unpublish","type":0,"val":"unpublish","end":""}],
    types: placeholder as Registry['admin.productions.unpublish']['types'],
  },
  'admin.productions.store': {
    methods: ["POST"],
    pattern: '/admin/productions',
    tokens: [{"old":"/admin/productions","type":0,"val":"admin","end":""},{"old":"/admin/productions","type":0,"val":"productions","end":""}],
    types: placeholder as Registry['admin.productions.store']['types'],
  },
  'admin.productions.publish': {
    methods: ["POST"],
    pattern: '/admin/productions/:id/publish',
    tokens: [{"old":"/admin/productions/:id/publish","type":0,"val":"admin","end":""},{"old":"/admin/productions/:id/publish","type":0,"val":"productions","end":""},{"old":"/admin/productions/:id/publish","type":1,"val":"id","end":""},{"old":"/admin/productions/:id/publish","type":0,"val":"publish","end":""}],
    types: placeholder as Registry['admin.productions.publish']['types'],
  },
  'admin.productions.files.store': {
    methods: ["POST"],
    pattern: '/admin/productions/:productionId/files',
    tokens: [{"old":"/admin/productions/:productionId/files","type":0,"val":"admin","end":""},{"old":"/admin/productions/:productionId/files","type":0,"val":"productions","end":""},{"old":"/admin/productions/:productionId/files","type":1,"val":"productionId","end":""},{"old":"/admin/productions/:productionId/files","type":0,"val":"files","end":""}],
    types: placeholder as Registry['admin.productions.files.store']['types'],
  },
  'admin.productions.files.destroy': {
    methods: ["DELETE"],
    pattern: '/admin/productions/:productionId/files/:fileId',
    tokens: [{"old":"/admin/productions/:productionId/files/:fileId","type":0,"val":"admin","end":""},{"old":"/admin/productions/:productionId/files/:fileId","type":0,"val":"productions","end":""},{"old":"/admin/productions/:productionId/files/:fileId","type":1,"val":"productionId","end":""},{"old":"/admin/productions/:productionId/files/:fileId","type":0,"val":"files","end":""},{"old":"/admin/productions/:productionId/files/:fileId","type":1,"val":"fileId","end":""}],
    types: placeholder as Registry['admin.productions.files.destroy']['types'],
  },
  'admin.productions.links.store': {
    methods: ["POST"],
    pattern: '/admin/productions/:productionId/links',
    tokens: [{"old":"/admin/productions/:productionId/links","type":0,"val":"admin","end":""},{"old":"/admin/productions/:productionId/links","type":0,"val":"productions","end":""},{"old":"/admin/productions/:productionId/links","type":1,"val":"productionId","end":""},{"old":"/admin/productions/:productionId/links","type":0,"val":"links","end":""}],
    types: placeholder as Registry['admin.productions.links.store']['types'],
  },
  'admin.productions.links.destroy': {
    methods: ["DELETE"],
    pattern: '/admin/productions/:productionId/links/:linkId',
    tokens: [{"old":"/admin/productions/:productionId/links/:linkId","type":0,"val":"admin","end":""},{"old":"/admin/productions/:productionId/links/:linkId","type":0,"val":"productions","end":""},{"old":"/admin/productions/:productionId/links/:linkId","type":1,"val":"productionId","end":""},{"old":"/admin/productions/:productionId/links/:linkId","type":0,"val":"links","end":""},{"old":"/admin/productions/:productionId/links/:linkId","type":1,"val":"linkId","end":""}],
    types: placeholder as Registry['admin.productions.links.destroy']['types'],
  },
  'admin.stats': {
    methods: ["GET","HEAD"],
    pattern: '/admin/stats',
    tokens: [{"old":"/admin/stats","type":0,"val":"admin","end":""},{"old":"/admin/stats","type":0,"val":"stats","end":""}],
    types: placeholder as Registry['admin.stats']['types'],
  },
  'admin.users.create': {
    methods: ["GET","HEAD"],
    pattern: '/admin/users/create',
    tokens: [{"old":"/admin/users/create","type":0,"val":"admin","end":""},{"old":"/admin/users/create","type":0,"val":"users","end":""},{"old":"/admin/users/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['admin.users.create']['types'],
  },
  'admin.users': {
    methods: ["GET","HEAD"],
    pattern: '/admin/users',
    tokens: [{"old":"/admin/users","type":0,"val":"admin","end":""},{"old":"/admin/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['admin.users']['types'],
  },
  'admin.users.store': {
    methods: ["POST"],
    pattern: '/admin/users',
    tokens: [{"old":"/admin/users","type":0,"val":"admin","end":""},{"old":"/admin/users","type":0,"val":"users","end":""}],
    types: placeholder as Registry['admin.users.store']['types'],
  },
  'admin.users.toggle-active': {
    methods: ["PATCH"],
    pattern: '/admin/users/:id/toggle-active',
    tokens: [{"old":"/admin/users/:id/toggle-active","type":0,"val":"admin","end":""},{"old":"/admin/users/:id/toggle-active","type":0,"val":"users","end":""},{"old":"/admin/users/:id/toggle-active","type":1,"val":"id","end":""},{"old":"/admin/users/:id/toggle-active","type":0,"val":"toggle-active","end":""}],
    types: placeholder as Registry['admin.users.toggle-active']['types'],
  },
  'admin.users.reset-password': {
    methods: ["POST"],
    pattern: '/admin/users/:id/reset-password',
    tokens: [{"old":"/admin/users/:id/reset-password","type":0,"val":"admin","end":""},{"old":"/admin/users/:id/reset-password","type":0,"val":"users","end":""},{"old":"/admin/users/:id/reset-password","type":1,"val":"id","end":""},{"old":"/admin/users/:id/reset-password","type":0,"val":"reset-password","end":""}],
    types: placeholder as Registry['admin.users.reset-password']['types'],
  },
  'admin.users.destroy': {
    methods: ["DELETE"],
    pattern: '/admin/users/:id',
    tokens: [{"old":"/admin/users/:id","type":0,"val":"admin","end":""},{"old":"/admin/users/:id","type":0,"val":"users","end":""},{"old":"/admin/users/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['admin.users.destroy']['types'],
  },
  'admin.activity': {
    methods: ["GET","HEAD"],
    pattern: '/admin/activity',
    tokens: [{"old":"/admin/activity","type":0,"val":"admin","end":""},{"old":"/admin/activity","type":0,"val":"activity","end":""}],
    types: placeholder as Registry['admin.activity']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
