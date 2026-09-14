import { ReactNode } from 'react';

import {
  Footer as FooterType,
  Header as HeaderType,
} from '@/shared/types/blocks/landing';
import { Footer } from '@/themes/default/blocks/footer';
import { Header } from '@/themes/default/blocks/header';

export default async function LandingLayout({
  children,
  header,
  footer,
}: {
  children: ReactNode;
  header: HeaderType;
  footer: FooterType;
}) {
  return (
    <div className="min-h-screen w-full overflow-x-clip">
      <Header header={header} />
      {children}
      <Footer footer={footer} />
    </div>
  );
}
