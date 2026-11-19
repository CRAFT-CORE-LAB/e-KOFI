import { contact } from '@/lib/contact';

type ContactDetailsProps = {
  className?: string;
  showMapLink?: boolean;
};

export function ContactDetails({ className = '', showMapLink = true }: ContactDetailsProps) {
  return (
    <address className={`not-italic ${className}`}>
      <p className="font-semibold text-navy">{contact.place}</p>
      <p className="mt-1 text-muted">
        {contact.street}
        <br />
        {contact.district}
        <br />
        {contact.city}
      </p>
      {showMapLink ? (
        <p className="mt-2">
          <a
            href={contact.mapsHref}
            className="font-semibold text-pine hover:text-navy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open in Maps
          </a>
        </p>
      ) : null}
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
