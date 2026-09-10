import { signInWithEmailPass, signUp } from "../../lib/auth";
import { qk } from "../querykeys";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useSignIn() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({ email, password }: { email: string; password: string }) =>
            signInWithEmailPass(email, password),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: qk.user})
        }
    })
}

export function useSignUp() {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: ({fullName, email, password}: {fullName: string, email: string, password: string}) =>
            signUp(fullName, email, password),
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: qk.user})
        }
    })
}