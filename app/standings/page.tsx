import { StandingsGrid } from "@/components/StandingsGrid";
import { predictions, qualifyByTeam } from "@/lib/predictions";

// Build the slug -> qualify map server-side; only ~48 numbers cross to client.
const projected = Object.fromEntries(qualifyByTeam(predictions.teams));

export default function StandingsPage() {
  return <StandingsGrid projected={projected} />;
}
