import { redirect } from 'next/navigation';
import {
  listConnections,
  listIncomingConnectionRequests,
  listQuestInvites,
} from '@/app/actions/party';
import PartyClient from '@/components/PartyClient';

export default async function PartyPage() {
  const data = await Promise.all([
    listIncomingConnectionRequests(),
    listQuestInvites(),
    listConnections(),
  ]).catch(() => redirect('/login'));

  const [requests, invites, allies] = data;

  return (
    <PartyClient
      initialRequests={requests}
      initialInvites={invites}
      initialAllies={allies}
    />
  );
}
