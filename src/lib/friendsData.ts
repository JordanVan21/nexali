import { supabase } from "../supabaseClient";
import type { FriendStatus, IncomingFriendRequest, NexaliUserPreview } from "./friends";

type SearchRow = { user_id: string; full_name: string | null; avatar_url: string | null; email: string | null; relationship_status: string };
type FriendRow = { user_id: string; full_name: string | null; avatar_url: string | null; email: string; friendship_id: string; friends_since: string };
type IncomingRow = { request_id: string; sender_user_id: string; sender_full_name: string | null; sender_avatar_url: string | null; created_at: string };

function toUserPreview(row: { full_name: string | null; avatar_url: string | null }, id: string, email: string | null, status: FriendStatus): NexaliUserPreview {
  return {
    id,
    fullName: row.full_name ?? "Nexali User",
    email,
    avatarUrl: row.avatar_url,
    status,
  };
}

/**
 * Real, bounded, privacy-safe user search (search_nexali_users -- Backend
 * Part 8). `email` arrives already `null` from the server for every
 * non-exact-match row -- this function does not (and must not) attempt to
 * fetch it from anywhere else.
 */
export async function searchNexaliUsers(query: string): Promise<NexaliUserPreview[]> {
  const { data, error } = await supabase.rpc("search_nexali_users", { p_query: query });
  if (error) throw error;
  return ((data ?? []) as SearchRow[]).map((row) =>
    toUserPreview(row, row.user_id, row.email, row.relationship_status as FriendStatus)
  );
}

export async function listFriends(): Promise<NexaliUserPreview[]> {
  const { data, error } = await supabase.rpc("list_friends");
  if (error) throw error;
  return ((data ?? []) as FriendRow[]).map((row) => toUserPreview(row, row.user_id, row.email, "friends"));
}

export async function listIncomingFriendRequests(): Promise<IncomingFriendRequest[]> {
  const { data, error } = await supabase.rpc("list_incoming_friend_requests");
  if (error) throw error;
  return ((data ?? []) as IncomingRow[]).map((row) => ({
    requestId: row.request_id,
    senderId: row.sender_user_id,
    senderFullName: row.sender_full_name ?? "Nexali User",
    senderAvatarUrl: row.sender_avatar_url,
    createdAt: row.created_at,
  }));
}

/** Real count, not a fetch-all-then-count -- the Friends badge's data source. */
export async function getIncomingFriendRequestCount(): Promise<number> {
  const { data, error } = await supabase.rpc("get_incoming_friend_request_count");
  if (error) throw error;
  return data ?? 0;
}

/** Returns the new friend_requests row id. Throws a real, user-safe Postgres exception message on every rejected case (self-request, not found, already friends, duplicate/reverse pending) -- see the RPC's own doc comment for the exact rules. */
export async function sendFriendRequest(recipientId: string): Promise<string> {
  const { data, error } = await supabase.rpc("send_friend_request", { p_recipient_id: recipientId });
  if (error) throw error;
  return data as string;
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("accept_friend_request", { p_request_id: requestId });
  if (error) throw error;
}

export async function declineFriendRequest(requestId: string): Promise<void> {
  const { error } = await supabase.rpc("decline_friend_request", { p_request_id: requestId });
  if (error) throw error;
}

export async function removeFriend(friendUserId: string): Promise<void> {
  const { error } = await supabase.rpc("remove_friend", { p_friend_user_id: friendUserId });
  if (error) throw error;
}
