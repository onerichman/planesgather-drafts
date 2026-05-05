import JoinClient from './JoinClient';

export default function Page({ searchParams }: { searchParams: { code?: string } }) {
  return <JoinClient code={searchParams.code || ''} />;
}
