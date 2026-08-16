import type { Metadata } from "next";
import { Breadcrumb } from "@/components/interview/Breadcrumb";
import { LinesRoot } from "@/components/interview/LinesRoot";

export const metadata: Metadata = {
  title: "Saved lines",
  description:
    "Every family line saved in this browser, what each one currently produces, and how to follow a different parent.",
};

export default function LinesPage() {
  return (
    <>
      <Breadcrumb
        trail={[{ href: "/check", label: "Check" }, { label: "Saved lines" }]}
      />
      <LinesRoot />
    </>
  );
}
