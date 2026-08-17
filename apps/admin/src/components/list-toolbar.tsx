import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
export function ListToolbar({
  search,
  setSearch,
  placeholder,
  children,
}: {
  search: string;
  setSearch: (value: string) => void;
  placeholder: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 border-b p-4 sm:flex-row">
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="pl-9"
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </div>
      {children}
    </div>
  );
}
