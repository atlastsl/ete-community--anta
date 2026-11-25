import * as React from "react"

import { cn } from "~/lib/utils"

// shadcn/ui v4 Skeleton, added by hand (Story 12.4, D-12.4-8): stone colour of the public
// site, pulse only when the visitor accepts motion (`motion-safe`).
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("rounded-md bg-stone-200 motion-safe:animate-pulse", className)}
      {...props}
    />
  )
}

export { Skeleton }
