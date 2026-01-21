/* -----------------------------------------------------------------------------
  IMPROVE RLS POLICIES (Optimized)
  Date: 2025-12-12
  
  Adds missing policies for Tasks, Subjects, Groups, and Members.
  Uses (select auth.uid()) for consistent performance.
  -----------------------------------------------------------------------------
*/

BEGIN;

  -----------------------------------------------------------------------------
  -- 1. TASKS: Add DELETE Policy (Permanent Delete)
  -----------------------------------------------------------------------------
  -- Allows users to permanently remove their own tasks immediately.
  -- (Soft deletion is already covered by the existing UPDATE policy).
  
  CREATE POLICY "Users can delete own tasks" 
    ON public.tasks 
    FOR DELETE 
    TO authenticated
    USING ((select auth.uid()) = user_id);

  -----------------------------------------------------------------------------
  -- 2. SUBJECTS: Add UPDATE Policy
  -----------------------------------------------------------------------------
  -- Allows owners to rename or change colors of their subjects.
  
  CREATE POLICY "Subjects: owners can update" 
    ON public.subjects 
    FOR UPDATE 
    TO authenticated
    USING ((select auth.uid()) = owner_id)
    WITH CHECK ((select auth.uid()) = owner_id);

  -----------------------------------------------------------------------------
  -- 3. GROUPS: Add DELETE Policy
  -----------------------------------------------------------------------------
  -- Allows Creators or Group Admins to delete the group.
  
  CREATE POLICY "Group creators and admins can delete groups" 
    ON public.groups 
    FOR DELETE 
    TO authenticated
    USING (
      -- Creator can delete
      (select auth.uid()) = created_by
      OR
      -- Group admin can delete
      EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = groups.id
          AND gm.user_id = (select auth.uid())
          AND gm.role = 'group_admin'
          AND gm.status = 'approved'
      )
    );

  -----------------------------------------------------------------------------
  -- 4. GROUP_MEMBERS: Add UPDATE Policy (For admin operations)
  -----------------------------------------------------------------------------
  -- Allows Group Admins to approve requests or change roles.
  
  CREATE POLICY "Group admins can update memberships" 
    ON public.group_members 
    FOR UPDATE 
    TO authenticated
    USING (
      -- User must be a group admin of the group (checking OLD row)
      EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = group_members.group_id
          AND gm.user_id = (select auth.uid())
          AND gm.role = 'group_admin'
          AND gm.status = 'approved'
      )
    )
    WITH CHECK (
      -- User must be a group admin of the group (checking NEW row)
      EXISTS (
        SELECT 1
        FROM public.group_members gm
        WHERE gm.group_id = group_members.group_id
          AND gm.user_id = (select auth.uid())
          AND gm.role = 'group_admin'
          AND gm.status = 'approved'
      )
    );

COMMIT;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- After running this migration, verify:
-- 
-- 1. Tasks DELETE policy exists:
--    SELECT policyname, cmd, qual 
--    FROM pg_policies 
--    WHERE tablename = 'tasks' AND cmd = 'DELETE';
--    -- Should return "Users can delete own tasks"
--
-- 2. Subjects UPDATE policy exists:
--    SELECT policyname, cmd, qual 
--    FROM pg_policies 
--    WHERE tablename = 'subjects' AND cmd = 'UPDATE';
--    -- Should return "Subjects: owners can update"
--
-- 3. Groups DELETE policy exists:
--    SELECT policyname, cmd, qual 
--    FROM pg_policies 
--    WHERE tablename = 'groups' AND cmd = 'DELETE';
--    -- Should return "Group creators and admins can delete groups"
--
-- 4. Group_members UPDATE policy exists:
--    SELECT policyname, cmd, qual 
--    FROM pg_policies 
--    WHERE tablename = 'group_members' AND cmd = 'UPDATE';
--    -- Should return "Group admins can update memberships"
--
-- 5. Test that users can delete their own tasks:
--    -- As authenticated user, try: DELETE FROM tasks WHERE id = '<your-task-id>';
--
-- 6. Test that subject owners can update their subjects:
--    -- As authenticated user, try: UPDATE subjects SET name = 'New Name' WHERE id = '<your-subject-id>' AND owner_id = auth.uid();
--
-- 7. Test that group creators/admins can delete groups:
--    -- As group creator/admin, try: DELETE FROM groups WHERE id = '<group-id>';

