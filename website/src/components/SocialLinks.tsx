import { contact } from '@/lib/contact';

export function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-3 text-sm font-semibold ${className}`}>
      <a href={contact.emailHref} className="text-pine hover:text-navy">
        Email
      </a>
      <a href={contact.phoneHref} className="text-pine hover:text-navy">
        Call
      </a>
    </div>
  );
}
