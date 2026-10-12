import WarRoom from "./_components/WarRoom";
import { SessionProvider } from "./_components/session";

export default function Home() {
  return (
    <SessionProvider>
      <WarRoom />
    </SessionProvider>
  );
}
