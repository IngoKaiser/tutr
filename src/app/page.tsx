import { redirect } from "next/navigation";

/**
 * „Heute" ist der Start (Konzept §5): in 10–15 Minuten etwas Sinnvolles tun,
 * ohne zu suchen.
 */
export default function Root() {
  redirect("/heute");
}
