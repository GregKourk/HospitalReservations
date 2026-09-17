import { useMemo } from 'react'
import { useAuth } from '@/auth/context/auth-context'

function parseJwtPayload(token: string): Record<string, string> {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(decodeURIComponent(
      atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join('')
    ))
  } catch { return {} }
}

const EMPTY = {
  isGlobalViewer: false,
  isSupervisor:   false,
  isParentTenant: false,
  hasEditRole:    false,
  userTenantId:   null as number | null,
  tenantIds:      [] as number[],
}

export function useJwtClaims() {
  const { auth } = useAuth()
  return useMemo(() => {
    if (!auth?.token) return EMPTY
    try {
      const p       = parseJwtPayload(auth.token)
      const raw     = p['TenantIds'] ?? ''
      const tenantIds = raw.split(',').map(Number).filter(Boolean)
      return {
        isGlobalViewer: p['GlobalViewer'] === 'True',
        isSupervisor:   p['Supervisor']   === 'True',
        isParentTenant: tenantIds.length > 1,
        hasEditRole:    p['HasEditRole']  === 'True',
        userTenantId:   p['TenantId'] ? Number(p['TenantId']) : null,
        tenantIds,
      }
    } catch { return EMPTY }
  }, [auth?.token])
}
