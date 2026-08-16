import type { Metadata } from "next";
import Link from "next/link";
import { ConsentGate } from "@/components/ConsentGate";

export const metadata: Metadata = {
  title: "Check a family line",
  description:
    "Answer a short guided interview and see which paragraph of the Citizenship Act applies to each generation of your family line.",
};

export default function CheckPage() {
  return (
    <ConsentGate>
      <div className="mx-auto w-full max-w-2xl px-6 py-16">
        <h1 className="text-2xl font-semibold tracking-tight">
          The interview is not built yet
        </h1>
        <p className="mt-3 leading-7 text-muted">
          The classification engine underneath is written and tested. What is
          missing is the interview on top of it — one question at a time,
          starting with you and working back a generation at a time until it
          reaches an ancestor born in Canada, asking only the questions that can
          change the answer.
        </p>
        <p className="mt-4 leading-7 text-muted">
          In the meantime, the{" "}
          <Link
            href="/sources"
            className="text-brand underline underline-offset-4"
          >
            sources
          </Link>{" "}
          page lists the legislation, case law, and IRCC guidance the rules are
          being built from.
        </p>
      </div>
    </ConsentGate>
  );
}
