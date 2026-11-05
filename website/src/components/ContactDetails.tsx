import { contact } from '@/lib/contact';

export function ContactDetails({ className = '' }: { className?: string }) {
  return (
    <address className={`not-italic ${className}`}>
      <p className="font-semibold text-navy">{contact.place}</p>
      <p className="mt-1 text-muted">
        {contact.street}
        <br />
        {contact.city}
      </p>
      <p className="mt-3">
        <a href={contact.phoneHref} className="font-semibold text-navy hover:text-pine">
          {contact.phoneDisplay}
        </a>
      </p>
      <p className="mt-1">
        <a href={contact.emailHref} className="font-semibold text-pine hover:text-navy">
          {contact.email}
        </a>
      </p>
    </address>
  );
}
