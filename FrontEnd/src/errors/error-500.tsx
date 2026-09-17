import { Fragment } from 'react/jsx-runtime';
import { Link } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function Error500() {
  return (
    <Fragment>
      <div className="mb-10">
        <img
          src={toAbsoluteUrl('/media/illustrations/20.svg')}
          className="dark:hidden max-h-[160px]"
          alt="image"
        />
        <img
          src={toAbsoluteUrl('/media/illustrations/20-dark.svg')}
          className="light:hidden max-h-[160px]"
          alt="image"
        />
      </div>

      <Badge variant="destructive" appearance="outline" className="mb-3">
        500 Σφάλμα
      </Badge>

      <h3 className="text-2xl font-semibold text-mono text-center mb-2">
        Πρόβλημα στον διακομιστή
      </h3>

      <div className="text-base text-center text-secondary-foreground mb-10">
        Πρόβλημα στον διακομιστή. Παρακαλώ δοκιμάστε αργότερα ή &nbsp;
        <a
          href="https://devs.keenthemes.com"
          className="text-primary font-medium hover:text-primary-active"
        >
          Επικοινωνήστε με την ομάδα υποστήριξης
        </a>
        &nbsp; για βοήθεια.
      </div>

      <Button asChild>
        <Link to="/">Επιστροφή στην Αρχική Σελίδα</Link>
      </Button>
    </Fragment>
  );
}
