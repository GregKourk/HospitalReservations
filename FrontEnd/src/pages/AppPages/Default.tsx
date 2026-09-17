import { useState } from 'react'
import { isSignalRConnected, StartSignalR } from '@/Services/signalRService'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { UserPlus, X } from 'lucide-react'

export default function Default() {
  if (!isSignalRConnected()) {
    StartSignalR();
  }


  return (
    <div className="p-6" style={{ maxWidth: 800, margin: '40px auto' }}>
      sdbbffdb
    </div>
  )
}
