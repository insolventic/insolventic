import { requirePageAuth } from '@/lib/auth';
import { ProfileSettings } from './components/profile-settings';

export default async function ProfilePage() {
  // Verify authentication server-side before rendering (M-9)
  await requirePageAuth('/profile');

  return <ProfileSettings />;
}
