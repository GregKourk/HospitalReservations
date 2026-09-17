import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import notify from 'devextreme/ui/notify';
import { LoaderCircleIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/auth/context/auth-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { PatientDto, getOwnPatient } from '@/services/hospital-api';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="mb-1 block text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

export default function PatientProfilePage() {
  const { currentUser } = useAuth();
  const [patient, setPatient] = useState<PatientDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOwnPatient()
      .then(({ data }) => setPatient(data))
      .catch(() => notify('Αποτυχία φόρτωσης προφίλ.', 'error', 4000))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Προσωπικά Στοιχεία</h1>
        <p className="text-sm text-muted-foreground">Τα στοιχεία σου, όπως προέρχονται από τη σύνδεση Gov.gr.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoaderCircleIcon className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Στοιχεία λογαριασμού</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Ονοματεπώνυμο" value={currentUser?.fullName ?? '—'} />
            <Field label="Email" value={currentUser?.email ?? '—'} />
            <Field label="ΑΜΚΑ" value={patient?.amka ?? '—'} />
            <Field label="Ημερομηνία γέννησης" value={patient?.dateOfBirth ? format(new Date(patient.dateOfBirth), 'dd/MM/yyyy') : '—'} />
            <Field label="Τηλέφωνο" value={patient?.phone ?? '—'} />
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        Τα στοιχεία αυτά είναι μόνο για ανάγνωση — προέρχονται από την εξωτερική σύνδεση ταυτοποίησης (Gov.gr) και δεν επεξεργάζονται από εδώ.
      </p>
    </div>
  );
}
