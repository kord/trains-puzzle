import { useCallback, useEffect, useState } from 'react'

/**
 * Light/dark theme handling. The choice is stored so a manual toggle survives a
 * reload; with nothing stored we follow the OS. Either way `data-theme` ends up
 * on <html> — first from the bootstrap script in index.html so there is no
 * flash of the wrong palette, then kept in sync from here — and that attribute
 * is what the CSS palettes key off.
 */
export type Theme = 'light' | 'dark'

// Mirrored by the bootstrap script in index.html — keep the two in sync.
const THEME_KEY = 'trains.theme'

function isTheme(value: string | null): value is Theme {
    return value === 'light' || value === 'dark'
}

function systemTheme(): Theme {
    try {
        return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    } catch {
        return 'light'
    }
}

function readInitialTheme(): Theme {
    try {
        const stored = window.localStorage.getItem(THEME_KEY)
        if (isTheme(stored)) return stored
    } catch {
        // Storage can throw (e.g. private mode); fall back to the OS.
    }
    return systemTheme()
}

export function useTheme() {
    const [theme, setTheme] = useState<Theme>(readInitialTheme)

    useEffect(() => {
        document.documentElement.dataset.theme = theme
    }, [theme])

    const toggle = useCallback(() => {
        const next: Theme = theme === 'dark' ? 'light' : 'dark'
        try {
            window.localStorage.setItem(THEME_KEY, next)
        } catch {
            // Storage can throw (e.g. private mode); the toggle still works for
            // the rest of the session, it just will not be remembered.
        }
        setTheme(next)
    }, [theme])

    return { theme, toggle }
}
