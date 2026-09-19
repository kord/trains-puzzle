import { useTheme } from '../game/useTheme'

/** Floating light/dark switch, pinned to the top right of the page. */
export function ThemeToggle() {
    const { theme, toggle } = useTheme()
    const next = theme === 'dark' ? 'light' : 'dark'

    return (
        <button
            type="button"
            className="theme-toggle"
            onClick={toggle}
            title={`Switch to ${next} mode`}
            aria-label={`Switch to ${next} mode`}
        >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
    )
}

function SunIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
        >
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 1.5v2M12 20.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M1.5 12h2M20.5 12h2M4.6 19.4l1.4-1.4M18 6l1.4-1.4" />
        </svg>
    )
}

function MoonIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M20.5 15.2A8.8 8.8 0 0 1 8.8 3.5a8.8 8.8 0 1 0 11.7 11.7Z" />
        </svg>
    )
}
