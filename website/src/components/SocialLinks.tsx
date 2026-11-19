import { contact } from '@/lib/contact';
import { socialLinks } from '@/lib/social';

const linkClass = 'text-pine hover:text-navy';

export function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold ${className}`}>
      {socialLinks.map((item) => (
        <a
          key={item.label}
          href={item.href}
          className={linkClass}
          target="_blank"
          rel="noopener noreferrer"
        >
          {item.label}
        </a>
      ))}
      <a href={contact.emailHref} className={linkClass}>
        Email
      </a>
      <a href={contact.phoneHref} className={linkClass}>
        Call
      </a>
    </div>
  );
}
