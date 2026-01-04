import { redirect } from 'next/navigation';

const DASHBOARD_PATH = '/dashboard';

export default function HomePage(): JSX.Element {
  redirect(DASHBOARD_PATH);
}
