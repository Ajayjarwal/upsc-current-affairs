import Desk from '../desk';
import { requireUser } from '../auth';
import { signOutPath } from '../auth-paths';
export const dynamic = 'force-dynamic';
export const metadata = { title: 'Examples | UPSC Desk' };
export default async function ExamplesPage() {
  const user = await requireUser('/examples');
  return <Desk key="examples" collection="examples" account={{displayName:user.displayName,email:user.email,signOutUrl:signOutPath('/login')}} />;
}
