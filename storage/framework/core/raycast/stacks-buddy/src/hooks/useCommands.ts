import { useFetch } from "@raycast/utils";
import { BuddyCommand } from "../types";
import { API_URL } from "../config";

type UseCommandsOptions = {
    search?: string;
    version?: string;
};

export const useCommands = ({ search, version }: UseCommandsOptions) => {
    const query = new URLSearchParams();

    for(const [key, value] of Object.entries({ search, version })) {
        value && query.set(key, value);
    }

    const url = `${API_URL}/commands?${query.toString()}`
    const { data, isLoading } = useFetch<{ commands: BuddyCommand[] }>(url, {
        method: "GET"
    })

    return {
        commands: data?.commands?.filter((c) => !c?.signature?.startsWith("_")),
        isLoading
    }
}