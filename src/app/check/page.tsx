import type { Metadata } from "next";
import { CheckEntry } from "@/components/interview/CheckEntry";

export const metadata: Metadata = {
  title: "Check a family line",
  description:
    "Answer a short guided interview and see which paragraph of the Citizenship Act applies to each generation of your family line.",
};

/**
 * A Server Component so `metadata` works, wrapping the one client component
 * that needs to read localStorage. The consent gate is in the layout now, so it
 * wraps every page under /check rather than only this one.
 *
 * Nothing below here reads `useSearchParams`, so no Suspense boundary is
 * needed; /check/interview is the exception and says why.
 */
export default function CheckPage() {
  return <CheckEntry />;
}
