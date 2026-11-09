"use client";

import { ErrorView, type ErrorViewProps } from "@/components/shell/error-view";

export default function RouteError(props: ErrorViewProps) {
  return <ErrorView {...props} />;
}
