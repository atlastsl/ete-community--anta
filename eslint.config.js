import { configApp } from '@adonisjs/eslint-config'

// `database/schema.ts` est un fichier auto-généré (codegen Tuyau, requis par Vite
// au build) : on ne le linte pas — son formatage prettier près de la limite des
// 100 colonnes oscillait entre local et CI et faisait échouer le pipeline.
export default configApp({ ignores: ['database/schema.ts'] })
