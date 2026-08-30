import './App.css'
import { Board } from './components/Board'
import { Toolbar } from './components/Toolbar'
import { WinOverlay } from './components/WinOverlay'
import { useGameSession } from './game/useGameSession'

export default function App() {
  const game = useGameSession()

  return (
    <div className="app">
      <header className="app-header">
        <h1>Train Tracks</h1>
        <Toolbar
          mode={game.mode}
          tool={game.tool}
          dailySize={game.dailySize}
          practiceSize={game.practiceSize}
          dateLabel={game.dateLabel}
          today={game.today}
          dailyDate={game.dailyDate}
          calendarOpen={game.calendarOpen}
          calendarWrapRef={game.calendarWrapRef}
          solvedEasy={game.solvedEasy}
          solvedMedium={game.solvedMedium}
          solvedHard={game.solvedHard}
          onEnterDaily={game.enterDaily}
          onEnterPractice={game.enterPractice}
          onToggleCalendar={game.toggleCalendar}
          onSelectDate={game.selectDate}
          onSelectDailySize={game.selectDailySize}
          onChangeSize={game.changeSize}
          onNewPractice={game.newPractice}
          onRestart={game.restart}
          onSelectTool={game.setTool}
          onUndo={game.undo}
        />
      </header>

      {game.record ? (
        <Board
          puzzle={game.record.puzzle}
          cells={game.record.userCells}
          onCellClick={game.handleCellClick}
          onCellPaint={game.handleCellPaint}
          onStrokeStart={game.pushUndoSnapshot}
          onStrokeEnd={game.finishStroke}
        />
      ) : (
        <p className="hint">Generating puzzle…</p>
      )}

      <p className="hint">
        Left-click cycles dots through pieces · Drag to paint · Right-click marks empty (X) ·
        Right-drag from an X erases
      </p>

      {game.showWin && (
        <WinOverlay
          onDismiss={game.dismissWin}
          onNew={game.mode === 'practice' ? game.newPractice : undefined}
        />
      )}
    </div>
  )
}
