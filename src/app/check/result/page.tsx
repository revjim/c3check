import type { Metadata } from "next";
import { Breadcrumb } from "@/components/interview/Breadcrumb";
import { ResultRoot } from "@/components/result/ResultRoot";

export const metadata: Metadata = {
  title: "Your result",
  description:
    "Every generation in the line, the paragraph of the Citizenship Act that applies to each, what the answer rests on, and what is still unknown.",
};

/**
 * A Server Component so `metadata` works, wrapping the one client root.
 *
 * No Suspense boundary here: nothing below reads `useSearchParams`. That is not
 * an oversight; a result page addressed by a query string is exactly what
 * /privacy promises this site does not do.
 */
export default function ResultPage() {
  return (
    <>
      <Breadcrumb
        trail={[
          { href: "/check", label: "Check" },
          { href: "/check/interview", label: "Interview" },
          { label: "Result" },
        ]}
      />
      <ResultRoot />
    </>
  );
}
