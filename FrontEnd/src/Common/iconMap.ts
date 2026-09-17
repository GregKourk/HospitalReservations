import {
  Home,
  Users,
  Settings,
  FileText,
  LayoutDashboard,
  Calendar,
  Building2,
  Layers,
  Stethoscope,
  ShieldAlert,
  Bell,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const iconMap: Record<string, LucideIcon> = {
  home: Home,
  users: Users,
  settings: Settings,
  forms: FileText,
  dashboard: LayoutDashboard,
  calendar: Calendar,
  building: Building2,
  layers: Layers,
  stethoscope: Stethoscope,
  shield: ShieldAlert,
  bell: Bell,
}

export const resolveIcon = (iconName?: string): LucideIcon | undefined => {
  if (!iconName) return undefined
  return iconMap[iconName.toLowerCase()]
}