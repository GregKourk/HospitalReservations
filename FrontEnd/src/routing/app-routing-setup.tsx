import React, { useEffect, useMemo, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from '@/auth/require-auth';
import { Demo1Layout } from '@/layouts/demo1/layout';
import { ErrorRouting } from '@/errors/error-routing';
import { AuthRouting } from '@/auth/auth-routing';
import { useAuth } from '@/auth/context/auth-context';
import { PageItem } from '@/auth/lib/models';
import { mapPageItemsToRoutes } from '@/Common/mapPagesToRoutes';
import { useMenuConfig } from '@/providers/DynamicMenuProvider';
import AppWizardPage from '@/pages/wizard/app-wizard';

/**
 * All app page modules — eagerly loaded so components are available synchronously.
 * Glob covers: pages/AppPages/**\/*.tsx
 */const pageModules = import.meta.glob('@/pages/AppPages/**/*.tsx', { eager: true })

/**
 * Splits a PascalCase / camelCase string into lowercase words.
 */
function splitCamel(str: string): string[] {
  return str
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2') 
    .replace(/([a-z])([A-Z])/g, '$1_$2')         
    .toLowerCase()
    .split(/[_\s]+/)
    .filter(Boolean)
}

/**
 * Levenshtein edit distance between two strings.
 */
function editDistance(a: string, b: string): number {
  const row = Array.from({ length: a.length + 1 }, (_, i) => i)
  for (const c2 of b) {
    let prev = row[0]++
    for (let j = 0; j < a.length; j++) {
      const tmp = row[j + 1]
      row[j + 1] = Math.min(row[j + 1] + 1, row[j] + 1, prev + (a[j] !== c2 ? 1 : 0))
      prev = tmp
    }
  }
  return row[a.length]
}

/**
 * Returns true if `segment` fuzzy-matches any word in `words` (edit distance <= 2).
 */
function fuzzyMatchesAny(segment: string, words: string[]): boolean {
  return words.some((w) => editDistance(segment, w) <= 2)
}

/**
 * Resolves a React component from a routeElement string like "Ypomnimata_Se_Exelixi".
 *
 * Strategy:
 * 1. Split routeElement by "_" into segments  ["ypomnimata", "se", "exelixi"]
 * 2. For each candidate file path, split the path components by camelCase into words
 * 3. Every segment must fuzzy-match (edit distance <= 2) at least one word in the file path
 *
 * This handles DB/filename typos like:
 *   "Dimourgimena" (DB) <-> "Dimiourgimena" (file)  — edit distance 1
 *   "Nomothesia"   (DB) <-> "Nomotheisa"    (file)  — edit distance 2
 */
function resolveComponent(routeElement: string | null): React.ComponentType | null {
  if (!routeElement) return null

  const segments = routeElement.toLowerCase().split('_').filter(Boolean)

  // ── Pass 1: every segment must EXACTLY match a word in the file path ──────
  let match = Object.entries(pageModules).find(([filePath]) => {
    const pathWords = filePath
      .replace('/src/pages/AppPages/', '')
      .replace('.tsx', '')
      .split('/')
      .flatMap(splitCamel)

    return segments.every((seg) => pathWords.includes(seg))
  })

  // ── Pass 2: fall back to fuzzy (edit distance ≤ 2) for typo tolerance ─────
  if (!match) {
    match = Object.entries(pageModules).find(([filePath]) => {
      const pathWords = filePath
        .replace('/src/pages/AppPages/', '')
        .replace('.tsx', '')
        .split('/')
        .flatMap(splitCamel)

      return segments.every((seg) => fuzzyMatchesAny(seg, pathWords))
    })
  }

  if (!match) {
    console.warn(`[AppRoutingSetup] No component found for routeElement: "${routeElement}"`)
    return null
  }

  return (match[1] as any).default ?? null
}

/**
 * Strips leading slash — React Router v6 nested <Route path> must not start with "/".
 */
function normalizePath(path: string): string {
  return path.replace(/^\//, '')
}

interface AppRoute {
  path: string
  component: React.ComponentType
}

function NoMenuItemsMessage() {
  return (
    <div className="p-6">
      <p className="text-sm text-muted-foreground">
        Ο ρόλος σου δεν έχει ακόμα καμία διαθέσιμη οθόνη.
      </p>
    </div>
  )
}

export function AppRoutingSetup() {
  const { pagesAllowed } = useAuth()
  const { setMenu } = useMenuConfig()

  // ─── Build routes from backend PageItem tree (synchronously) ─────────────
  // Using useMemo instead of useEffect+useState so routes are available on the
  // very first render — prevents the catch-all from firing on page refresh.
  const appRoutes = useMemo<AppRoute[]>(() => {
    if (!pagesAllowed?.length) return []

    const routes: AppRoute[] = []

    const buildRoutes = (items: PageItem[]) => {
      for (const page of items) {
        if (page.routeElement) {
          const Component = resolveComponent(page.routeElement)

          // KEY: use navUrl first — that is what the sidebar menu actually navigates to.
          // routeCombPath uses a /pages/... prefix that does NOT match navUrl links → 404.
          const rawPath = page.navUrl ?? page.routeCombPath ?? ''

          if (Component && rawPath) {
            routes.push({ path: normalizePath(rawPath), component: Component })
          }
        }

        if (page.pages?.length) {
          buildRoutes(page.pages)
        }
      }
    }

    buildRoutes(pagesAllowed)

    // Deduplicate by path (keeps first occurrence)
    const seen = new Set<string>()
    return routes.filter(({ path }) => {
      if (seen.has(path)) return false
      seen.add(path)
      return true
    })
  }, [pagesAllowed])

  // ─── Sync sidebar menu ────────────────────────────────────────────────────
  useEffect(() => {
    if (!pagesAllowed?.length) return
    setMenu(mapPageItemsToRoutes(pagesAllowed))
  }, [pagesAllowed, setMenu])

  // ─── Routes ───────────────────────────────────────────────────────────────
  return (
    <Routes>
      <Route element={<RequireAuth />}>
        <Route element={<Demo1Layout />}>

          {/* Redirect root "/" to the first page the role-driven menu grants
              (LoginApplicationForms/LoginApplicationFormRights, built at
              login by MenuBuilder.BuildRootPagesAsync). A role with no
              granted forms yet (Doctor/Patient, until those screens exist)
              gets a clear message instead of a guessed redirect. */}
          <Route
            index
            element={
              appRoutes.length
                ? <Navigate to={appRoutes[0].path} replace />
                : <NoMenuItemsMessage />
            }
          />

          {/* Static route — app-onboarding wizard, not driven by LoginApplicationForms data */}
          <Route
            path="app-wizard"
            element={
              <Suspense fallback={<div className="p-6">Loading...</div>}>
                <AppWizardPage />
              </Suspense>
            }
          />

          {/* All dynamic routes — paths match navUrl from backend */}
          {appRoutes.map(({ path, component: Component }) => (
            <Route
              key={path}
              path={path}
              element={
                <Suspense fallback={<div className="p-6">Loading...</div>}>
                  <Component />
                </Suspense>
              }
            />
          ))}

        </Route>
      </Route>

      <Route path="auth/*" element={<AuthRouting />} />
      <Route path="error/*" element={<ErrorRouting />} />

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/error/404" />} />
    </Routes>
  )
}
