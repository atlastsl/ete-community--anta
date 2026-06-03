import '@adonisjs/core/types/http'

type ParamValue = string | number | bigint | boolean

export type ScannedRoutes = {
  ALL: {
    'home': { paramsTuple?: []; params?: {} }
    'productions': { paramsTuple?: []; params?: {} }
    'production.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'production.download': { paramsTuple: [ParamValue,ParamValue]; params: {'slug': ParamValue,'fileId': ParamValue} }
    'privacy-policy': { paramsTuple?: []; params?: {} }
    'stats.view': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.login.submit': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'admin.auth.change-password': { paramsTuple?: []; params?: {} }
    'admin.auth.change-password.submit': { paramsTuple?: []; params?: {} }
    'admin.productions.create': { paramsTuple?: []; params?: {} }
    'admin.productions.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions': { paramsTuple?: []; params?: {} }
    'admin.productions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.unpublish': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.store': { paramsTuple?: []; params?: {} }
    'admin.productions.publish': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.files.store': { paramsTuple: [ParamValue]; params: {'productionId': ParamValue} }
    'admin.productions.files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'productionId': ParamValue,'fileId': ParamValue} }
    'admin.productions.links.store': { paramsTuple: [ParamValue]; params: {'productionId': ParamValue} }
    'admin.productions.links.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'productionId': ParamValue,'linkId': ParamValue} }
    'admin.stats': { paramsTuple?: []; params?: {} }
    'admin.users.create': { paramsTuple?: []; params?: {} }
    'admin.users': { paramsTuple?: []; params?: {} }
    'admin.users.store': { paramsTuple?: []; params?: {} }
    'admin.users.toggle-active': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.users.reset-password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.users.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.activity': { paramsTuple?: []; params?: {} }
  }
  GET: {
    'home': { paramsTuple?: []; params?: {} }
    'productions': { paramsTuple?: []; params?: {} }
    'production.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'production.download': { paramsTuple: [ParamValue,ParamValue]; params: {'slug': ParamValue,'fileId': ParamValue} }
    'privacy-policy': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.auth.change-password': { paramsTuple?: []; params?: {} }
    'admin.productions.create': { paramsTuple?: []; params?: {} }
    'admin.productions.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions': { paramsTuple?: []; params?: {} }
    'admin.stats': { paramsTuple?: []; params?: {} }
    'admin.users.create': { paramsTuple?: []; params?: {} }
    'admin.users': { paramsTuple?: []; params?: {} }
    'admin.activity': { paramsTuple?: []; params?: {} }
  }
  HEAD: {
    'home': { paramsTuple?: []; params?: {} }
    'productions': { paramsTuple?: []; params?: {} }
    'production.show': { paramsTuple: [ParamValue]; params: {'slug': ParamValue} }
    'production.download': { paramsTuple: [ParamValue,ParamValue]; params: {'slug': ParamValue,'fileId': ParamValue} }
    'privacy-policy': { paramsTuple?: []; params?: {} }
    'new_account.create': { paramsTuple?: []; params?: {} }
    'session.create': { paramsTuple?: []; params?: {} }
    'admin.login': { paramsTuple?: []; params?: {} }
    'admin.auth.change-password': { paramsTuple?: []; params?: {} }
    'admin.productions.create': { paramsTuple?: []; params?: {} }
    'admin.productions.edit': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions': { paramsTuple?: []; params?: {} }
    'admin.stats': { paramsTuple?: []; params?: {} }
    'admin.users.create': { paramsTuple?: []; params?: {} }
    'admin.users': { paramsTuple?: []; params?: {} }
    'admin.activity': { paramsTuple?: []; params?: {} }
  }
  POST: {
    'stats.view': { paramsTuple?: []; params?: {} }
    'new_account.store': { paramsTuple?: []; params?: {} }
    'session.store': { paramsTuple?: []; params?: {} }
    'session.destroy': { paramsTuple?: []; params?: {} }
    'admin.login.submit': { paramsTuple?: []; params?: {} }
    'admin.logout': { paramsTuple?: []; params?: {} }
    'admin.auth.change-password.submit': { paramsTuple?: []; params?: {} }
    'admin.productions.unpublish': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.store': { paramsTuple?: []; params?: {} }
    'admin.productions.publish': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.files.store': { paramsTuple: [ParamValue]; params: {'productionId': ParamValue} }
    'admin.productions.links.store': { paramsTuple: [ParamValue]; params: {'productionId': ParamValue} }
    'admin.users.store': { paramsTuple?: []; params?: {} }
    'admin.users.reset-password': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PUT: {
    'admin.productions.update': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  DELETE: {
    'admin.productions.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
    'admin.productions.files.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'productionId': ParamValue,'fileId': ParamValue} }
    'admin.productions.links.destroy': { paramsTuple: [ParamValue,ParamValue]; params: {'productionId': ParamValue,'linkId': ParamValue} }
    'admin.users.destroy': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
  PATCH: {
    'admin.users.toggle-active': { paramsTuple: [ParamValue]; params: {'id': ParamValue} }
  }
}
declare module '@adonisjs/core/types/http' {
  export interface RoutesList extends ScannedRoutes {}
}