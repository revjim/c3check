import type { Metadata } from "next";
import { ConsentGate } from "@/components/ConsentGate";

/**
 * One gate for every page under /check, rather than one per page.
 *
 * `robots` is set here so it is inherited by the interview, the import screen,
 * the saved lines and the report: none of those has anything a search engine
 * should index, they are all a view onto data that exists only in one person's
 * browser, and an indexed URL would be an empty page with a consent gate in
 * front of it. `follow` stays true so the links out to /sources and /privacy
 * still count.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function CheckLayout({ children }: LayoutProps<"/check">) {
  return <ConsentGate>{children}</ConsentGate>;
}
