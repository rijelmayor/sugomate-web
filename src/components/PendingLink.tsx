"use client";

import Link, { useLinkStatus } from "next/link";
import type { CSSProperties, ReactNode } from "react";

function LinkSpinner() {
  const { pending } = useLinkStatus();
  return pending ? <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" /> : null;
}

export default function PendingLink({ href, className = "", style, children, ...rest }: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  "aria-current"?: "page" | undefined;
  "aria-label"?: string;
}) {
  return <Link href={href} style={style} className={`${className} inline-flex items-center gap-1.5 transition active:scale-[.97]`} {...rest}><LinkSpinner />{children}</Link>;
}
