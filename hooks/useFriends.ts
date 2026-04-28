import { useCallback, useEffect, useMemo, useState } from "react";

import {
  acceptFriendRequest,
  deleteFriendship,
  fetchFriendshipsWithProfiles,
  fetchFriendsActivity,
  sendFriendRequest,
  type FriendActivityItem,
  type FriendshipWithOther,
} from "@/utils/queries";

export function useFriends(userId: string | null) {
  const [friendships, setFriendships] = useState<FriendshipWithOther[]>([]);
  const [activity, setActivity] = useState<FriendActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFriendships = useCallback(async () => {
    if (!userId) return;
    const rows = await fetchFriendshipsWithProfiles(userId);
    setFriendships(rows);
  }, [userId]);

  const loadActivity = useCallback(async () => {
    if (!userId) return;
    const rows = await fetchFriendsActivity(30, 0);
    setActivity(rows);
  }, [userId]);

  const loadAll = useCallback(
    async (opts?: { isRefresh?: boolean }) => {
      if (!userId) return;
      if (opts?.isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);
      try {
        await Promise.all([loadFriendships(), loadActivity()]);
      } catch (e) {
        console.error("useFriends load error", e);
        setError("load");
      } finally {
        if (opts?.isRefresh) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    },
    [userId, loadFriendships, loadActivity]
  );

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const onRefresh = useCallback(() => loadAll({ isRefresh: true }), [loadAll]);

  const sendRequest = useCallback(
    async (addresseeId: string) => {
      if (!userId) return;
      await sendFriendRequest(userId, addresseeId);
      await loadFriendships();
    },
    [userId, loadFriendships]
  );

  const accept = useCallback(
    async (friendshipId: string) => {
      await acceptFriendRequest(friendshipId);
      await Promise.all([loadFriendships(), loadActivity()]);
    },
    [loadFriendships, loadActivity]
  );

  const removeOrDecline = useCallback(
    async (friendshipId: string) => {
      await deleteFriendship(friendshipId);
      await Promise.all([loadFriendships(), loadActivity()]);
    },
    [loadFriendships, loadActivity]
  );

  const pendingReceived = useMemo(
    () => friendships.filter((f) => f.status === "pending" && f.addressee_id === userId),
    [friendships, userId]
  );

  const pendingSent = useMemo(
    () => friendships.filter((f) => f.status === "pending" && f.requester_id === userId),
    [friendships, userId]
  );

  const acceptedFriends = useMemo(
    () => friendships.filter((f) => f.status === "accepted"),
    [friendships]
  );

  return {
    friendships,
    activity,
    pendingReceived,
    pendingSent,
    acceptedFriends,
    loading,
    refreshing,
    error,
    onRefresh,
    sendRequest,
    accept,
    removeOrDecline,
    reload: loadAll,
  };
}
