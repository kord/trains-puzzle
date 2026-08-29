interface WinOverlayProps {
    onDismiss: () => void
    onNew?: () => void
}

export function WinOverlay({ onDismiss, onNew }: WinOverlayProps) {
    return (
        <div className="win-overlay" role="dialog" aria-modal="true">
            <div className="win-card">
                <h2>Solved! 🎉</h2>
                <p>You laid the track correctly.</p>
                <div className="win-actions">
                    <button type="button" onClick={onDismiss}>
                        Keep playing
                    </button>
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
