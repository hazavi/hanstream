import { Suspense, type ComponentProps } from "react";
import PagesApp from "./PagesApp";
import { PageSkeleton } from "./PageSkeleton";

export function ReaderPage(props: ComponentProps<typeof PagesApp>) {
  return (
    <Suspense fallback={<PageSkeleton view={props.view} />}>
      <PagesApp {...props} />
    </Suspense>
  );
}
