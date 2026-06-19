import { Button } from "@/components/ui/button";
import { EddyIcon } from "@/components/eddy/EddyIcon";

export function EddyButton({ children = "Ask Eddy", ...props }: React.ComponentProps<typeof Button>) {
  return <Button {...props}><EddyIcon size={18} className="mr-2 h-[18px] w-[18px]" />{children}</Button>;
}
