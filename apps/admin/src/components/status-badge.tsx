import type { AccessStatus } from "@/types/admin";
import { Badge } from "@/components/ui/badge";
const styles: Record<AccessStatus, string> = {
  active:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  expired:
    "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  blocked: "border-rose-500/25 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  no_access: "text-muted-foreground",
};
export function StatusBadge({ status }: { status: AccessStatus }) {
  return (
    <Badge className={styles[status]}>
      {status === "no_access"
        ? "New"
        : status[0].toUpperCase() + status.slice(1)}
    </Badge>
  );
}
