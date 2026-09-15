import { context } from '@devvit/web/client';

type SplashLeaderboardResponse = {
  players: Array<{ username: string; power: number }>;
};

/** Render the read-only leaderboard before the deferred game bundle loads. */
export function initSplashLeaderboard(): void {
  const overlay = document.getElementById('overlay');
  if (!overlay || document.getElementById('splash-leaderboard')) return;

  const style = document.createElement('style');
  style.textContent = `
    #splash-leaderboard { position:absolute; bottom:78px; left:50%; transform:translateX(-50%); width:min(360px,calc(100% - 24px)); padding:10px 12px; border:1px solid rgba(79,255,176,.45); background:rgba(0,10,5,.92); color:#8ff7cf; font:10px monospace; z-index:10; }
    #splash-leaderboard[hidden] { display:none; }
    #splash-leaderboard-btn { display:flex; align-items:center; gap:10px; background:rgba(8,22,32,.66); border:1.5px solid #58d7e6; border-radius:12px; color:#dff6ff; font:bold 15px monospace; letter-spacing:.4px; padding:13px 22px; cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,.45),0 0 16px rgba(88,215,230,.22),inset 0 0 12px rgba(88,215,230,.07); transition:background .15s ease,box-shadow .15s ease,border-color .15s ease; }
    #splash-leaderboard-btn:hover { background:rgba(22,52,66,.82); border-color:#8af2ff; box-shadow:0 2px 12px rgba(0,0,0,.5),0 0 22px rgba(88,215,230,.45),inset 0 0 14px rgba(88,215,230,.12); }
    #splash-leaderboard h3 { color:#4fffb0; font-size:12px; letter-spacing:1px; margin:0 0 7px; }
    .splash-score-row { display:grid; grid-template-columns:22px minmax(0,1fr) 42px; gap:6px; padding:4px 0; border-top:1px solid rgba(79,255,176,.14); }
    .splash-score-row strong { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .splash-score-row span:last-child { color:#ffcc66; text-align:right; }
    #splash-leaderboard .splash-muted { color:#5a9a7a; }
    @media (max-height:500px) { #splash-leaderboard { bottom:62px; padding:6px 10px; } #splash-leaderboard-btn { font-size:11px; padding:8px 10px; } .splash-score-row { padding:2px 0; } }
  `;
  document.head.appendChild(style);

  const board = document.createElement('section');
  board.id = 'splash-leaderboard';
  board.setAttribute('aria-label', 'Leaderboard');
  board.hidden = true;
  board.innerHTML = '<h3>LEADERBOARD</h3><div class="splash-muted">Loading current standings...</div>';
  const buttonRow = document.getElementById('btn-row');
  if (buttonRow) {
    const boardButton = document.createElement('button');
    boardButton.id = 'splash-leaderboard-btn';
    boardButton.type = 'button';
    const trophy = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3"/></svg>';
    boardButton.innerHTML = trophy + 'Leaderboard';
    boardButton.addEventListener('click', (event) => {
      event.stopPropagation();
      board.hidden = !board.hidden;
      boardButton.innerHTML = trophy + (board.hidden ? 'Leaderboard' : 'Close Board');
    });
    buttonRow.insertBefore(boardButton, buttonRow.firstChild);
  }
  overlay.appendChild(board);

  const postId = context.postId ?? 'standalone:dev';
  void fetch(`/api/leaderboard?postId=${encodeURIComponent(postId)}`)
    .then((response) => response.ok
      ? response.json() as Promise<SplashLeaderboardResponse>
      : Promise.reject(new Error('leaderboard request failed')))
    .then((data) => {
      const top = data.players.slice(0, 5);
      board.innerHTML = '<h3>LEADERBOARD</h3>' + (top.length > 0
        ? top.map((player, index) => `<div class="splash-score-row"><span>${index + 1}</span><strong>${player.username}</strong><span>${player.power}</span></div>`).join('')
        : '<div class="splash-muted">No standings yet</div>');
    })
    .catch(() => {
      board.innerHTML = '<h3>LEADERBOARD</h3><div class="splash-muted">Standings unavailable</div>';
    });
}
