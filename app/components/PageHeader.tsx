import FeedbackButton from "./FeedbackButton";
import SettingsButton from "./SettingsButton";

// Shared top of every page: a small line above a big title, optional actions,
// and the Leave a note and Settings buttons.
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
      <div className="flex items-center gap-1.5 shrink-0">
        {children}
        <FeedbackButton />
        <SettingsButton />
      </div>
    </header>
  );
}
