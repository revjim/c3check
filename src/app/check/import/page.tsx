import type { Metadata } from "next";
import { Breadcrumb } from "@/components/interview/Breadcrumb";
import { ImportRoot } from "@/components/interview/ImportRoot";

export const metadata: Metadata = {
  title: "Import a family tree",
  description:
    "Read a GEDCOM export in your own browser, pick the line most likely to reach an ancestor born in Canada, and start from there.",
};

/**
 * A Server Component so `metadata` works, wrapping the one client root. No
 * `useSearchParams` below here, so no Suspense boundary is needed.
 */
export default function ImportPage() {
  return (
    <>
      <Breadcrumb
        trail={[
          { href: "/check", label: "Check" },
          { label: "Import a family tree" },
        ]}
      />
      <ImportRoot />
    </>
  );
}
