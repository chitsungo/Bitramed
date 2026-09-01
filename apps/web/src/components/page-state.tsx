import { AlertTriangle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
export function PageLoading() {
  return (
    <div className="space-y-5" aria-label="Loading">
      <Skeleton className="h-9 w-52" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => (
          <Skeleton className="h-28" key={item} />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}
export function ErrorState({
  message,
  retry,
}: {
  message: string;
  retry: () => void;
}) {
  return (
    <div className="grid min-h-80 place-items-center rounded-xl border border-dashed">
      <div className="max-w-sm text-center">
        <AlertTriangle className="mx-auto mb-3 size-7 text-destructive" />
        <h2 className="font-semibold">Unable to load admin data</h2>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <Button className="mt-4" variant="outline" onClick={retry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
export function EmptyState({
  title = "Nothing to show",
  description = "Try adjusting the search or filters.",
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="grid min-h-48 place-items-center">
      <div className="text-center">
        <Inbox className="mx-auto mb-3 size-6 text-muted-foreground" />
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
