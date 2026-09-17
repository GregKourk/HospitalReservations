import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';

export function Error404() {
  return (
    <>
      <div className="mb-10">
        <img
          src={toAbsoluteUrl('/media/illustrations/19.svg')}
          className="dark:hidden max-h-[160px]"
          alt="image"
        />
        <img
          src={toAbsoluteUrl('/media/illustrations/19-dark.svg')}
          className="hidden dark:block max-h-[160px]"
          alt="image"
        />
      </div>

      <span className="badge badge-primary badge-outline mb-3">404 Σφάλμα</span>

      <h3 className="text-2xl font-semibold text-mono text-center mb-2">
        Ουπς... Δεν βρέθηκε η σελίδα
      </h3>

      <div className="text-base text-center text-secondary-foreground mb-10">
        Η ζητούμενη σελίδα δεν υπάρχει. Ελέγξτε τη διεύθυνση ή&nbsp;
        <Link
          to="/"
          className="text-primary font-medium hover:text-primary-active"
        >
          Επιστροφή στην Αρχική Σελίδα
        </Link>
        .
      </div>
    </>
  );
}
