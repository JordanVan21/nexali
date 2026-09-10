import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "../querykeys";
import { uploadAvatar, deleteOnlyAvatar } from "../../lib/storage";
import { supabase } from "../../supabaseClient";
import type { Database } from "../../types/database.types";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function pathFromPublicUrl(publicUrl: string): string | null {
  try {
    const u = new URL(publicUrl);
    const prefix = "/storage/v1/object/public/avatars/";
    const i = u.pathname.indexOf(prefix);
    if (i === -1) return null;
    return decodeURIComponent(u.pathname.slice(i + prefix.length)); // e.g. "a1a9...9061-IMG_2142.JPG" or "users/123.jpg"
  } catch {
    return null;
  }
}

export function useUploadAvatar(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const publicUrl = await uploadAvatar(userId, file);
      const patch: Pick<ProfileRow, "avatar_url"> = { avatar_url: publicUrl };
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw error;
      return publicUrl;
    },
    onSuccess: async () => {
      qc.setQueryData(["avatar", userId], null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["avatar", userId] }),
        qc.invalidateQueries({ queryKey: qk.profile(userId) }),
      ]);
    },
  });
}

export function useDeleteAvatar(userId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await deleteOnlyAvatar(userId);
      const { error } = await supabase.from("profiles").update({ avatar_url: null }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      qc.setQueryData(["avatar", userId], null);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["avatar", userId] }),
        qc.invalidateQueries({ queryKey: qk.profile(userId) }),
      ]);
    },
  });
}

export function useAvatar(userId?: string) {
  return useQuery<string | null>({
    queryKey: ["avatar", userId],
    enabled: !!userId,
    staleTime: Infinity,
    gcTime: Infinity,
    queryFn: async () => {
      if(!userId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data?.avatar_url ?? null;
    },
    select: (url) => (url ? `${url}?v=${Date.now()}` : null),
  });
}