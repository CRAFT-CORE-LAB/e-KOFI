import type { Metadata } from 'next';
import { ParentPortal } from '@/components/ParentPortal';

export const metadata: Metadata = {
  title: 'Parent wallet',
  description: 'Add lunch money to your child’s e-KOFI wallet using their Student ID.',
};

export default function ParentWalletPage() {
  return (
    <div className="rise pb-16">
      <ParentPortal />
    </div>
  );
}
