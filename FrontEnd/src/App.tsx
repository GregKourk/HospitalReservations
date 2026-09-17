import { AppRouting } from '@/routing/app-routing';
import { HelmetProvider } from 'react-helmet-async';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { LoadingBarContainer } from 'react-top-loading-bar';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from './auth/context/auth-context';
import { I18nProvider } from './providers/i18n-provider';
import { ModulesProvider } from './providers/modules-provider';
import { QueryProvider } from './providers/query-provider';
import { SettingsProvider } from './providers/settings-provider';
import { ThemeProvider } from './providers/theme-provider';
import { TooltipsProvider } from './providers/tooltips-provider';
import { DynamicMenuProvider } from './providers/DynamicMenuProvider';
import { useTheme } from 'next-themes'
import { useEffect } from 'react'

const { BASE_URL } = import.meta.env;
const queryClient = new QueryClient();

function DevExtremeThemeSync() {
  const { resolvedTheme } = useTheme()

  useEffect(() => {
    const linkId = 'dx-theme-link'
    let link = document.getElementById(linkId) as HTMLLinkElement | null
    if (!link) {
      link = document.createElement('link')
      link.id = linkId
      link.rel = 'stylesheet'
      document.head.appendChild(link)
    }
    link.href = resolvedTheme === 'dark'
      ? '/css/dx.fluent.blue.dark.css'
      : '/css/dx.fluent.blue.light.css'
  }, [resolvedTheme])

  return null
}

function GlobalDarkStyles() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  useEffect(() => {
    const styleId = 'dx-dark-overrides'
    let style = document.getElementById(styleId)
    if (!style) {
      style = document.createElement('style')
      style.id = styleId
      document.head.appendChild(style)
    }
    style.textContent = isDark ? `
  .dx-popup-wrapper .dx-overlay-content { background-color: #13141f !important; color: #c9cee6 !important; }
  .dx-popup-wrapper .dx-popup-title { background-color: #1a1b2e !important; color: #c9cee6 !important; border-bottom-color: #2d3149 !important; }
  .dx-popup-wrapper .dx-popup-content { background-color: #13141f !important; color: #c9cee6 !important; }
  .dx-popup-wrapper .dx-closebutton { color: #c9cee6 !important; }
  .dx-overlay-shader { background-color: rgba(0,0,0,0.6) !important; }
` : ''
  }, [isDark])

  return null
}

export function App() {


  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SettingsProvider>
          <ThemeProvider>
            <DevExtremeThemeSync />
            <GlobalDarkStyles />
            <I18nProvider>
              <HelmetProvider>
                <TooltipsProvider>
                  <QueryProvider>
                    <LoadingBarContainer>
                      <DynamicMenuProvider>
                          <BrowserRouter basename={BASE_URL}>
                            <Toaster />
                            <ModulesProvider>
                              <AppRouting />
                            </ModulesProvider>
                          </BrowserRouter>
                      </DynamicMenuProvider>
                    </LoadingBarContainer>
                  </QueryProvider>
                </TooltipsProvider>
              </HelmetProvider>
            </I18nProvider>
          </ThemeProvider>
        </SettingsProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
