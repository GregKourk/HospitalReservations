import { Link, Outlet } from 'react-router-dom';
import { toAbsoluteUrl } from '@/lib/helpers';
import { Card, CardContent } from '@/components/ui/card';

//background-image: url('${toAbsoluteUrl('/media/images/2600x1600/1.png')}');

export function BrandedLayout() {
  return (
    <>
    
      <style>
        {`
          .branded-bg {            
            background-image: url('${toAbsoluteUrl('/media/images/950x980/EPOE-brand.png')}');
          }
          .dark .branded-bg {
            background-image: url('${toAbsoluteUrl('/media/images/950x980/EPOE-brand.png')}');
            // background-image: url('${toAbsoluteUrl('/media/images/2600x1600/1-dark.png')}');
          }
        `}
      </style>
      <div className="grid lg:grid-cols-2 grow">
        <div className="flex justify-center items-center p-8 lg:p-10 order-2 lg:order-1">
          <Card className="w-full max-w-[400px]">
            <CardContent className="p-6">
              <Outlet />
            </CardContent>
          </Card>
        </div>

        <div className="flex justify-center items-center lg:rounded-xl lg:border lg:border-border lg:m-5 order-1 lg:order-2 bg-top xxl:bg-center xl:bg-cover bg-no-repeat branded-bg">
          <Link to="/">
            <img
              src={toAbsoluteUrl('/media/brand-logos/cloud-one.svg')}
              className="h-20 max-w-none"
              alt="Logo"
            />
          </Link>
        </div>
      </div>
    </>
  );
}
