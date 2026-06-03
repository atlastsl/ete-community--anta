import '@adonisjs/inertia/types'

import type React from 'react'
import type { Prettify } from '@adonisjs/core/types/common'

type ExtractProps<T> =
  T extends React.FC<infer Props>
    ? Prettify<Omit<Props, 'children'>>
    : T extends React.Component<infer Props>
      ? Prettify<Omit<Props, 'children'>>
      : never

declare module '@adonisjs/inertia/types' {
  export interface InertiaPages {
    'admin/ActivityLogs/Index': ExtractProps<(typeof import('../../inertia/pages/admin/ActivityLogs/Index.tsx'))['default']>
    'admin/Auth/ChangePassword': ExtractProps<(typeof import('../../inertia/pages/admin/Auth/ChangePassword.tsx'))['default']>
    'admin/Auth/Login': ExtractProps<(typeof import('../../inertia/pages/admin/Auth/Login.tsx'))['default']>
    'admin/Productions/Create': ExtractProps<(typeof import('../../inertia/pages/admin/Productions/Create.tsx'))['default']>
    'admin/Productions/Edit': ExtractProps<(typeof import('../../inertia/pages/admin/Productions/Edit.tsx'))['default']>
    'admin/Productions/Index': ExtractProps<(typeof import('../../inertia/pages/admin/Productions/Index.tsx'))['default']>
    'admin/Stats/Index': ExtractProps<(typeof import('../../inertia/pages/admin/Stats/Index.tsx'))['default']>
    'admin/Users/Create': ExtractProps<(typeof import('../../inertia/pages/admin/Users/Create.tsx'))['default']>
    'admin/Users/Index': ExtractProps<(typeof import('../../inertia/pages/admin/Users/Index.tsx'))['default']>
    'auth/login': ExtractProps<(typeof import('../../inertia/pages/auth/login.tsx'))['default']>
    'auth/signup': ExtractProps<(typeof import('../../inertia/pages/auth/signup.tsx'))['default']>
    'errors/not_found': ExtractProps<(typeof import('../../inertia/pages/errors/not_found.tsx'))['default']>
    'errors/server_error': ExtractProps<(typeof import('../../inertia/pages/errors/server_error.tsx'))['default']>
    'home': ExtractProps<(typeof import('../../inertia/pages/home.tsx'))['default']>
    'privacy-policy': ExtractProps<(typeof import('../../inertia/pages/privacy-policy.tsx'))['default']>
    'production': ExtractProps<(typeof import('../../inertia/pages/production.tsx'))['default']>
    'productions': ExtractProps<(typeof import('../../inertia/pages/productions.tsx'))['default']>
  }
}
