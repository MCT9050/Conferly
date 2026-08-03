"use client";

type PresenterLabelProps = {
  participantName: string;
  isLocal?: boolean;
};

export default function PresenterLabel({
  participantName,
  isLocal = false,
}: PresenterLabelProps) {
  const trimmedName = participantName.trim();
  const label = isLocal
    ? "You are presenting"
    : `${trimmedName || "Participant"} is presenting`;

  return (
    <p
      role="status"
      className="rounded-full bg-slate-950/75 px-3 py-1 text-sm font-medium text-slate-100 shadow-sm ring-1 ring-white/10"
    >
      {label}
    </p>
  );
}