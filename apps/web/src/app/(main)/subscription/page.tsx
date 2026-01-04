import { Card } from '../../../components/ui/Card';

const TITLE = 'Subscription';
const BODY_TEXT = 'Subscription placeholder content.';

export default function SubscriptionPage(): JSX.Element {
  return (
    <Card>
      <h1 className='text-2xl font-semibold text-slate-900'>{TITLE}</h1>
      <p className='mt-2 text-sm text-slate-500'>{BODY_TEXT}</p>
    </Card>
  );
}
