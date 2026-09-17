import React, { ReactNode } from 'react';
import { useAuth } from '@/auth/context/auth-context';
import { Moon, LogOut } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Switch } from '@/components/ui/switch';

// ── Initials circle ───────────────────────────────────────────────────────────
export function UserInitials({ name, className, ...props }: { name: string; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const parts = name.trim().split(' ').filter(Boolean)
  const ini = parts.length >= 2
    ? parts[0][0] + parts[parts.length - 1][0]
    : (parts[0]?.[0] ?? '?')
  return (
    <div className={`rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold select-none ${className ?? 'size-9 text-sm'}`} {...props}>
      {ini.toUpperCase()}
    </div>
  )
}

// ── Connected trigger (reads currentUser internally) ───────────────────────────
export function UserAvatarTrigger(props: React.HTMLAttributes<HTMLDivElement>) {
  const { currentUser } = useAuth()
  const name = currentUser?.fullName ?? '?'
  return (
    <UserInitials
      name={name}
      className="size-9 text-sm shrink-0 cursor-pointer border-2 border-primary/30"
      {...props}
    />
  )
}

// ── Dropdown ──────────────────────────────────────────────────────────────────
export function UserDropdownMenu({ trigger }: { trigger: ReactNode }) {
  const { logout, currentUser } = useAuth()
  const { theme, setTheme } = useTheme()

  const fullName = currentUser?.fullName ?? 'Χρήστης'
  const amka     = currentUser?.amka     ?? '—'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent className="w-72" side="bottom" align="end">

        {/* ── Στοιχεία χρήστη ── */}
        <div className="p-4 flex gap-3 items-start">
          <UserInitials name={fullName} className="size-10 text-sm shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm text-foreground truncate">Χρήστης: {fullName}</div>
            <div className="text-xs text-muted-foreground mt-0.5">ΑΜΚΑ: {amka}</div>
          </div>
        </div>

        <DropdownMenuSeparator />

        {/* ── Σκοτεινό θέμα ── */}
        <DropdownMenuItem className="flex items-center gap-2" onSelect={(e) => e.preventDefault()}>
          <Moon />
          <div className="flex items-center gap-2 justify-between grow">
            Σκοτεινό θέμα
            <Switch size="sm" checked={theme === 'dark'} onCheckedChange={(v) => setTheme(v ? 'dark' : 'light')} />
          </div>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        {/* ── Αποσύνδεση ── */}
        <div className="p-2">
          <Button variant="outline" size="sm" className="w-full gap-2" onClick={logout}>
            <LogOut className="size-4" />
            Αποσύνδεση
          </Button>
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  )
}
