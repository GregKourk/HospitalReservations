import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataGridRef } from 'devextreme-react/data-grid';
import { Button } from '@/components/ui/button';
import { EntityGrid } from '@/components/common/entity-grid';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function ApplicationsPage() {
  const navigate = useNavigate();
  const gridRef = useRef<DataGridRef>(null);
  const [justAdded, setJustAdded] = useState<{ appId: number; appDesc: string } | null>(null);

  function handleRowInserted(data: any) {
    setJustAdded({ appId: data.appId, appDesc: data.appDesc });
  }

  function continueInWizard() {
    if (!justAdded) return;
    navigate('/app-wizard', {
      state: { existingAppId: justAdded.appId, existingAppName: justAdded.appDesc },
    });
    setJustAdded(null);
  }

  return (
    <div className="space-y-4">
      <div className="px-6 pt-6 flex gap-2">
        <Button onClick={() => gridRef.current?.instance().addRow()}>+ Προσθήκη Εφαρμογής</Button>
        <Button variant="outline" onClick={() => navigate('/app-wizard')}>+ Προσθήκη Εφαρμογής (Wizard)</Button>
      </div>
      <EntityGrid
        ref={gridRef}
        apiRoute="Applications"
        keyField="appId"
        editMode="popup"
        hideAddButton
        onRowInserted={handleRowInserted}
        columns={[
          { dataField: 'appId', caption: 'ID', dataType: 'number', allowEditing: false },
          { dataField: 'appDesc', caption: 'Περιγραφή', dataType: 'string', required: 'Η περιγραφή είναι υποχρεωτική.' },
        ]}
      />

      <AlertDialog open={!!justAdded} onOpenChange={(open) => !open && setJustAdded(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Εισαγωγή υπόλοιπων στοιχείων;</AlertDialogTitle>
            <AlertDialogDescription>
              Η εφαρμογή "{justAdded?.appDesc}" δημιουργήθηκε. Θέλετε να συνεχίσετε τώρα με τις σελίδες,
              τα groups και τις διαχειριζόμενες μονάδες της;
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Όχι</AlertDialogCancel>
            <AlertDialogAction onClick={continueInWizard}>Ναι</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
