import React, { Suspense } from "react"
import { useLocation } from "react-router-dom"

const pages = import.meta.glob("../pages/AppPages/**/*.tsx")

export default function DynamicPageLoader() {
  const location = useLocation()

  const route = location.pathname
    .replace("/", "")
    .replaceAll("-", "_")

  const pagePath = Object.keys(pages).find((path) =>
    path.toLowerCase().includes(route.toLowerCase())
  )

  if (!pagePath) {
    return <div className="p-6">Page not found</div>
  }

  const Component = React.lazy(pages[pagePath] as any)

  return (
    <Suspense fallback={<div className="p-6">Loading...</div>}>
      <Component />
    </Suspense>
  )
}