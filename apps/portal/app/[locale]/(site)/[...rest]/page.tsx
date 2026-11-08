import { notFound } from "next/navigation";

// Sends unknown paths to the localised not-found page.
export default function CatchAll() {
  notFound();
}
