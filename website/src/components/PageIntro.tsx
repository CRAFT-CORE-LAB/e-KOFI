export function PageIntro({
  eyebrow,
  title,
  lede,
}: {
  eyebrow: string;
  title: string;
  lede: string;
}) {
  return (
    <header className="mx-auto max-w-3xl px-6 pb-8 pt-16 sm:pt-20">
      <p className="text-sm font-semibold text-pine">{eyebrow}</p>
      <h1 className="mt-3 text-4xl font-semibold tracking-tight text-navy sm:text-5xl">{title}</h1>
      <p className="mt-4 text-lg leading-8 text-navy/75">{lede}</p>
    </header>
  );
}
