import { use } from 'react';
import JoinClient from './JoinClient';

export default function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const resolvedParams = use(searchParams);
  return <JoinClient code={resolvedParams.code || ''} />;
}
