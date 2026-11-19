export const social = {
  displayName: 'e-KOFI',
  handle: 'ekofi_rw',
  website: 'https://e-kofi.com',
  profiles: {
    instagram: 'https://www.instagram.com/ekofi_rw/',
    x: 'https://x.com/ekofi_rw',
    facebook: 'https://www.facebook.com/ekofi_rw',
    linkedin: 'https://www.linkedin.com/company/ekofi-rw',
    tiktok: 'https://www.tiktok.com/@ekofi_rw',
  },
} as const;

export const socialLinks = [
  { label: 'Instagram', href: social.profiles.instagram },
  { label: 'X', href: social.profiles.x },
  { label: 'Facebook', href: social.profiles.facebook },
  { label: 'LinkedIn', href: social.profiles.linkedin },
  { label: 'TikTok', href: social.profiles.tiktok },
] as const;
