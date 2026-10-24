import AppColorsButton from "./AppColorsButton";

// Shared top of every page: a small line above a big title, optional actions,
// and the App colors button.
export default function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex items-center justify-between gap-3 pt-2 mb-4">
      <div className="min-w-0">
        {eyebrow && <p className="text-xs font-bold text-dim truncate">{eyebrow}</p>}
        <h1 className="text-[26px] leading-tight font-black tracking-tight text-balance">{title}</h1>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {children}
        <AppColorsButton />
      </div>
    </header>
  );
}
