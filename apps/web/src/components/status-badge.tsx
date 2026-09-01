import type { AccessStatus } from "@/types/admin";
import { Badge } from "@/components/ui/badge";
const styles: Record<AccessStatus, string> = {
  active: "border-success/25 bg-success/10 text-success",
  expired: "border-warning/25 bg-warning/10 text-warning",
  blocked: "border-destructive/25 bg-destructive/10 text-destructive",
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
