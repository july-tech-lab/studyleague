import { useCallback, useEffect, useState } from "react";
import {
  createGroup,
  fetchPublicGroups,
  fetchUserGroups,
  findGroupByInviteCode,
  Group,
  GroupVisibility,
  MembershipStatus,
  requestJoinGroup,
} from "@/utils/queries";
import { supabase } from "@/utils/supabase";

export interface UseGroupsOptions {
  userId: string | null;
  autoLoad?: boolean; // Whether to automatically load groups on mount
}

export interface UseGroupsReturn {
  groups: Group[]; // User's approved groups
  publicGroups: Group[]; // Public groups user is not a member of
  loading: boolean;
  error: Error | null;
  createGroup: (payload: {
    name: string;
    description?: string | null;
    visibility?: GroupVisibility;
    requires_admin_approval?: boolean;
    join_password?: string | null;
  }) => Promise<Group>;
  joinGroup: (group: Group, password?: string | null) => Promise<MembershipStatus>;
  searchGroupByCode: (code: string) => Promise<Group | null>;
  refetch: () => Promise<void>;
}

export function useGroups({
  userId,
  autoLoad = true,
}: UseGroupsOptions): UseGroupsReturn {
  const [groups, setGroups] = useState<Group[]>([]);
  const [publicGroups, setPublicGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const loadGroups = useCallback(async () => {
    if (!userId) {
      setGroups([]);
      setPublicGroups([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Load user's groups
      const userGroups = await fetchUserGroups(userId);
      setGroups(userGroups);

      // Load public groups (excluding ones user is already in)
      const memberIds = userGroups.map((g) => g.id);
      const publicData = await fetchPublicGroups(memberIds);
      setPublicGroups(publicData);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      console.error("Error loading groups", err);
      setGroups([]);
      setPublicGroups([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (autoLoad) {
      loadGroups();
    }
  }, [loadGroups, autoLoad]);

  // Subscribe to group_members changes for real-time updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel("group-members-listener")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_members",
          filter: `user_id=eq.${userId}`,
        },
        () => {
          loadGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, loadGroups]);

  const handleCreateGroup = useCallback(
    async (payload: {
      name: string;
      description?: string | null;
      visibility?: GroupVisibility;
      requires_admin_approval?: boolean;
      join_password?: string | null;
    }): Promise<Group> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const created = await createGroup(userId, payload);
        // Refresh groups list
        await loadGroups();
        return created;
      } catch (err) {
        console.error("Error creating group", err);
        throw err;
      }
    },
    [userId, loadGroups]
  );

  const handleJoinGroup = useCallback(
    async (group: Group, password?: string | null): Promise<MembershipStatus> => {
      if (!userId) {
        throw new Error("User not authenticated");
      }

      try {
        const member = await requestJoinGroup(group.id, password);
        // Refresh groups list
        await loadGroups();
        return member.status ?? "approved";
      } catch (err) {
        console.error("Error joining group", err);
        throw err;
      }
    },
    [userId, loadGroups]
  );

  const handleSearchGroupByCode = useCallback(
    async (code: string): Promise<Group | null> => {
      try {
        const found = await findGroupByInviteCode(code);
        if (found && found.visibility === "public") {
          // Add to public groups if not already present
          setPublicGroups((prev) => {
            if (prev.some((g) => g.id === found.id)) return prev;
            return [found, ...prev];
          });
        }
        return found;
      } catch (err) {
        console.error("Error searching group by code", err);
        throw err;
      }
    },
    []
  );

  return {
    groups,
    publicGroups,
    loading,
    error,
    createGroup: handleCreateGroup,
    joinGroup: handleJoinGroup,
    searchGroupByCode: handleSearchGroupByCode,
    refetch: loadGroups,
  };
}
