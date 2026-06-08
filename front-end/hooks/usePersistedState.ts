import { useEffect, useState } from "react";

export default function usePersistedState<T>(key: string, initialValue: T):
    [T, React.Dispatch<React.SetStateAction<T>>] {
    const [state, setState] = useState(() => {
        const stickyValue = localStorage.getItem(key);
        return stickyValue !== null ? JSON.parse(stickyValue) : initialValue;
    });

    useEffect(() => {
        localStorage.setItem(key, JSON.stringify(state));
    }, [key, state]);

    return [state, setState];
}