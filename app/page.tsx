import Desk from './desk';
import { requireUser } from './auth';
import { signOutPath } from './auth-paths';
export const dynamic = 'force-dynamic';
export default async function Home() {
  const user = await requireUser('/');
  return <Desk account={{displayName:user.displayName,email:user.email,signOutUrl:signOutPath('/login')}} />;
}
