import type { Metadata } from 'next';
import { StudentPortal } from '@/components/StudentPortal';

export const metadata: Metadata = {
  title: 'Student wallet',
  description: 'Students sign in with Student ID and password to see lunch money balance and meal history.',
};

export default function StudentWalletPage() {
  return (
    <div className="rise pb-16">
      <StudentPortal />
    </div>
  );
}
