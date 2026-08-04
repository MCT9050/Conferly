"use client";

import type { RemotePresentation } from "../../types/presentation";
import PresentationVideo from "./PresentationVideo";
import PresenterLabel from "./PresenterLabel";

type PresentationStageProps = {
  presentation: RemotePresentation | null;
  className?: string;
};

export default function PresentationStage({
  presentation,
  className = "",
}: PresentationStageProps) {
  if (!presentation) {
    return null;
  }

  const isStarting = presentation.videoPublication !== null && presentation.videoTrack === null;
  const presenterName = presentation.participantName || presentation.participantIdentity;

  return (
    <section
      aria-label="Shared presentation"
      className={`w-full overflow-hidden rounded-3xl border border-white/10 bg-slate-950 shadow-2xl shadow-black/30 ${className}`.trim()}
    >
      <div className="relative flex aspect-video min-h-[14rem] max-h-[min(72vh,48rem)] w-full items-center justify-center overflow-hidden bg-slate-950 sm:min-h-[18rem] lg:min-h-[22rem]">
        <PresentationVideo
          track={presentation.videoTrack}
          label={`${presenterName || "Participant"} presentation video`}
          className="max-h-full min-h-0"
        />

        <div className="pointer-events-none absolute left-3 top-3 z-10 sm:left-4 sm:top-4">
          <PresenterLabel participantName={presenterName} />
        </div>

        {isStarting && (
          <div
            aria-live="polite"
            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-slate-950/75 px-6 text-center text-sm font-medium text-slate-200 sm:text-base"
          >
            Starting presentation…
          </div>
        )}
      </div>
    </section>
  );
}