import type { Metadata } from "next";
import { Suspense } from "react";
import { Breadcrumb } from "@/components/interview/Breadcrumb";
import { InterviewRoot } from "@/components/interview/InterviewRoot";

export const metadata: Metadata = {
  title: "The interview",
  description:
    "One question at a time, working back a generation at a time, asking only what can change the answer.",
};

/**
 * A Server Component so `metadata` works, wrapping the one client root.
 *
 * **The Suspense boundary is mandatory, not stylistic.** `InterviewRoot` calls
 * `useSearchParams`, and on a statically rendered route that works in
 * `next dev` and fails `next build`. Remove the boundary and the failure shows
 * up in CI rather than on the machine that made the change. Run `npm run build`
 * before pushing anything that touches this route.
 */
export default function InterviewPage() {
  return (
    <>
      <Breadcrumb
        trail={[{ href: "/check", label: "Check" }, { label: "Interview" }]}
      />
      <Suspense fallback={<div aria-hidden className="min-h-[60vh]" />}>
        <InterviewRoot />
      </Suspense>
    </>
  );
}
