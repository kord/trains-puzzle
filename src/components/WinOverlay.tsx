interface WinOverlayProps {
    onDismiss: () => void
    onNew?: () => void
}

export function WinOverlay({ onDismiss, onNew }: WinOverlayProps) {
    return (
        <div className="win-overlay" role="dialog" aria-modal="true" onClick={onDismiss}>
            <div className="win-card" onClick={(e) => e.stopPropagation()}>
                <h2>Solved! 🎉</h2>
                <div className="win-actions">
                    {onNew && (
                        <button type="button" onClick={onNew}>
                            New puzzle
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
