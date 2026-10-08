(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const cats = [
    ['q1', 'Q1 score', 'score'],
    ['ht', 'Half-time score', 'score'],
    ['q3', 'Q3 score', 'score'],
    ['final', 'Final score', 'score'],
    ['attendance', 'Attendance', 'number'],
    ['rush', 'Longest rushing TD', 'yards'],
    ['pass', 'Longest passing TD', 'yards'],
    ['fg', 'Longest field goal', 'yards']
  ];

  let db = null;
  let auth = null;
  let user = null;
  let gameId = '';
  let gameData = null;
  let unsub = null;

  function status(message, error = false) {
    const el = $('status');
    if (!el) return;

    el.textContent = message;
    el.className = 'status ' + (error ? 'error' : 'ok');
  }

  function show(id) {
    $(id)?.classList.remove('hidden');
  }

  function hide(id) {
    $(id)?.classList.add('hidden');
  }

  function injectStyles() {
    if ($('predictionAdminStyles')) return;

    const style = document.createElement('style');

    style.id = 'predictionAdminStyles';

    style.textContent = `
      .admin-player {
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 14px;
        margin: 12px 0;
        background: #fff;
      }

      .admin-player h4 {
        margin: 0 0 10px;
        font-size: 18px;
      }

      .admin-player .player-name {
        width: 100%;
        margin-bottom: 10px;
      }

      .guess-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 8px;
      }

      .guess-grid label {
        font-size: 12px;
        font-weight: 600;
      }

      .guess-score {
        display: grid;
        grid-template-columns: 1fr auto 1fr;
        gap: 4px;
        align-items: center;
      }

      .guess-grid input {
        width: 100%;
        box-sizing: border-box;
      }

      .rankings {
        margin-top: 22px;
      }

      .result-card {
        border: 1px solid #ddd;
        border-radius: 12px;
        padding: 14px;
        margin: 12px 0;
        background: #fff;
      }

      .actual-result {
        font-size: 20px;
        font-weight: 800;
        margin: 6px 0 12px;
      }

      .rank-row {
        display: grid;
        grid-template-columns: 38px minmax(90px, 1fr) auto auto;
        gap: 8px;
        align-items: center;
        padding: 9px 0;
        border-top: 1px solid #eee;
      }

      .rank-row:first-of-type {
        border-top: 0;
      }

      .rank {
        font-weight: 800;
      }

      .guess {
        font-weight: 700;
      }

      .difference {
        color: #666;
        font-size: 13px;
        text-align: right;
      }

      .winner-row {
        font-weight: 800;
      }

      .waiting {
        color: #666;
        font-style: italic;
      }

      .save-note {
        margin: 8px 0 0;
        color: #555;
        font-size: 13px;
      }

      @media (max-width: 620px) {
        .guess-grid {
          grid-template-columns: 1fr;
        }

        .rank-row {
          grid-template-columns: 34px minmax(80px, 1fr) auto;
        }

        .difference {
          grid-column: 2 / 4;
          text-align: left;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function n(value) {
    return value === '' || value == null ? null : Number(value);
  }

  function completePrediction(p) {
    return cats.every(([id]) => {
      const value = p[id];

      return Array.isArray(value)
        ? value.every(x => Number.isFinite(x))
        : Number.isFinite(value);
    });
  }

  function distance(pred, actual, type) {
    if (type === 'score') {
      return (
        Math.abs(pred[0] - actual[0]) +
        Math.abs(pred[1] - actual[1])
      );
    }

    return Math.abs(pred - actual);
  }

  function format(value, type) {
    if (type === 'score') {
      return `${value[0]} – ${value[1]}`;
    }

    return `${value}${type === 'yards' ? ' yards' : ''}`;
  }

  function actualsFromInputs() {
    return {
      q1: [
        n($('aq1h').value),
        n($('aq1a').value)
      ],

      ht: [
        n($('ahth').value),
        n($('ahta').value)
      ],

      q3: [
        n($('aq3h').value),
        n($('aq3a').value)
      ],

      final: [
        n($('afh').value),
        n($('afa').value)
      ],

      attendance: n($('aattendance').value),
      rush: n($('arush').value),
      pass: n($('apass').value),
      fg: n($('afg').value)
    };
  }

  function actualComplete(value) {
    return cats.every(([id]) => {
      const v = value[id];

      return Array.isArray(v)
        ? v.every(x => Number.isFinite(x))
        : Number.isFinite(v);
    });
  }

  function predictionFromPlayerCard(index) {
    const root = $(`adminPlayer${index}`);

    const p = {};

    p.q1 = [
      n(root.querySelector('[data-f="q1h"]').value),
      n(root.querySelector('[data-f="q1a"]').value)
    ];

    p.ht = [
      n(root.querySelector('[data-f="hth"]').value),
      n(root.querySelector('[data-f="hta"]').value)
    ];

    p.q3 = [
      n(root.querySelector('[data-f="q3h"]').value),
      n(root.querySelector('[data-f="q3a"]').value)
    ];

    p.final = [
      n(root.querySelector('[data-f="fh"]').value),
      n(root.querySelector('[data-f="fa"]').value)
    ];

    p.attendance =
      n(root.querySelector('[data-f="attendance"]').value);

    p.rush =
      n(root.querySelector('[data-f="rush"]').value);

    p.pass =
      n(root.querySelector('[data-f="pass"]').value);

    p.fg =
      n(root.querySelector('[data-f="fg"]').value);

    return p;
  }

  function buildPlayerInputs() {
    injectStyles();

    let holder = $('adminPlayerInputs');

    if (!holder) {
      holder = document.createElement('div');
      holder.id = 'adminPlayerInputs';

      const actuals = $('actuals');

      actuals.insertBefore(
        holder,
        $('saveActualsBtn')
      );
    }

    holder.innerHTML = `
      <h3>Player guesses</h3>

      <p class="note">
        Enter each player's guesses here. You can save them before
        the game starts, then enter actual results as the game progresses.
      </p>

      <div id="playerCards"></div>

      <button id="saveGuessesBtn" type="button">
        Save all player guesses
      </button>

      <p class="save-note">
        All eight players can be entered from this screen.
      </p>
    `;

    const cards = $('playerCards');

    const players = gameData?.players || {};

    const existing = Object.values(players);

    for (let i = 0; i < 8; i++) {

      const saved = existing[i] || {};
      const p = saved.predictions || {};

      const card = document.createElement('div');

      card.className = 'admin-player';
      card.id = `adminPlayer${i}`;

      card.innerHTML = `
        <h4>Player ${i + 1}</h4>

        <input
          class="player-name"
          data-f="name"
          type="text"
          placeholder="Player ${i + 1} name"
          value="${escapeHtml(saved.playerName || '')}"
        >

        <div class="guess-grid">

          ${scoreField(
            'Q1 score',
            'q1h',
            'q1a',
            p.q1
          )}

          ${scoreField(
            'Half-time score',
            'hth',
            'hta',
            p.ht
          )}

          ${scoreField(
            'Q3 score',
            'q3h',
            'q3a',
            p.q3
          )}

          ${scoreField(
            'Final score',
            'fh',
            'fa',
            p.final
          )}

          ${numberField(
            'Attendance',
            'attendance',
            p.attendance
          )}

          ${numberField(
            'Longest rushing TD',
            'rush',
            p.rush
          )}

          ${numberField(
            'Longest passing TD',
            'pass',
            p.pass
          )}

          ${numberField(
            'Longest field goal',
            'fg',
            p.fg
          )}

        </div>
      `;

      cards.appendChild(card);
    }

    $('saveGuessesBtn').onclick = saveGuesses;
  }

  function escapeHtml(value) {
    return String(value).replace(
      /[&<>'"]/g,
      c => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[c])
    );
  }

  function scoreField(label, a, b, value) {

    const x = Array.isArray(value)
      ? value
      : ['', ''];

    return `
      <label>
        ${label}

        <div class="guess-score">

          <input
            data-f="${a}"
            type="number"
            min="0"
            value="${x[0] ?? ''}"
          >

          <span>–</span>

          <input
            data-f="${b}"
            type="number"
            min="0"
            value="${x[1] ?? ''}"
          >

        </div>
      </label>
    `;
  }

  function numberField(label, id, value) {

    return `
      <label>
        ${label}

        <input
          data-f="${id}"
          type="number"
          min="0"
          value="${value ?? ''}"
        >
      </label>
    `;
  }

  async function saveGuesses() {

    try {

      const players = {};

      const existingIds =
        Object.keys(gameData?.players || {});

      for (let i = 0; i < 8; i++) {

        const root = $(`adminPlayer${i}`);

        const name =
          root.querySelector('[data-f="name"]')
            .value
            .trim();

        const prediction =
          predictionFromPlayerCard(i);

        if (!name) {
          throw new Error(
            `Enter a name for Player ${i + 1}.`
          );
        }

        if (!completePrediction(prediction)) {
          throw new Error(
            `Complete all guesses for ${name}.`
          );
        }

        const uid =
          existingIds[i] ||
          `admin-player-${i + 1}`;

        players[uid] = {
          playerName: name,
          predictions: prediction,
          submitted: true,
          enteredByAdmin: true
        };
      }

      await db
        .collection('games')
        .doc(gameId)
        .set(
          { players },
          { merge: true }
        );

      gameData =
        (
          await db
            .collection('games')
            .doc(gameId)
            .get()
        ).data();

      buildPlayerInputs();

      renderRankings();

      status(
        'All eight player guesses saved.'
      );

    } catch (e) {

      console.error(e);

      status(
        e.message ||
        'Could not save guesses.',
        true
      );
    }
  }

  function renderRankings() {

    const target = $('adminWinners');

    if (!target) return;

    injectStyles();

    const actual =
      gameData?.actual || {};

    const players =
      Object.values(
        gameData?.players || {}
      ).filter(
        p => p.predictions && p.playerName
      );

    target.className = 'rankings';

    target.innerHTML =
      '<h3>Results — closest to furthest</h3>';

    cats.forEach(
      ([id, label, type]) => {

        const card =
          document.createElement('div');

        card.className =
          'result-card';

        const actualValue =
          actual[id];

        card.innerHTML =
          `<h3>${label}</h3>`;

        if (
          actualValue == null ||
          (
            Array.isArray(actualValue) &&
            actualValue.some(x => x == null)
          )
        ) {

          card.innerHTML +=
            '<div class="waiting">Waiting for actual result</div>';

          target.appendChild(card);

          return;
        }

        card.innerHTML +=
          `<div class="actual-result">
             ACTUAL: ${format(actualValue, type)}
           </div>`;

        const ranked =
          players
            .filter(
              p => p.predictions[id] != null
            )
            .map(
              p => ({
                player: p.playerName,
                guess: p.predictions[id],
                diff: distance(
                  p.predictions[id],
                  actualValue,
                  type
                )
              })
            )
            .sort(
              (a, b) =>
                a.diff - b.diff ||
                a.player.localeCompare(b.player)
            );

        if (!ranked.length) {

          card.innerHTML +=
            '<div class="waiting">No guesses entered yet.</div>';

        } else {

          let previous = null;
          let rank = 0;

          ranked.forEach(
            (r, index) => {

              if (r.diff !== previous) {
                rank = index + 1;
              }

              previous = r.diff;

              const row =
                document.createElement('div');

              row.className =
                'rank-row' +
                (r.diff === 0
                  ? ' winner-row'
                  : '');

              row.innerHTML = `
                <span class="rank">
                  ${
                    rank === 1
                      ? '🥇'
                      : rank === 2
                      ? '🥈'
                      : rank === 3
                      ? '🥉'
                      : rank
                  }
                </span>

                <span>
                  ${escapeHtml(r.player)}
                </span>

                <span class="guess">
                  ${format(r.guess, type)}
                </span>

                <span class="difference">
                  ${
                    r.diff === 0
                      ? 'EXACT'
                      : r.diff + ' away'
                  }
                </span>
              `;

              card.appendChild(row);
            }
          );
        }

        target.appendChild(card);
      }
    );
  }

  function loadActualInputs() {

    const a =
      gameData?.actual || {};

    const map = {
      q1: ['aq1h', 'aq1a'],
      ht: ['ahth', 'ahta'],
      q3: ['aq3h', 'aq3a'],
      final: ['afh', 'afa']
    };

    Object.entries(map).forEach(
      ([key, ids]) => {

        if (Array.isArray(a[key])) {

          $(ids[0]).value =
            a[key][0] ?? '';

          $(ids[1]).value =
            a[key][1] ?? '';
        }
      }
    );

    [
      'attendance',
      'rush',
      'pass',
      'fg'
    ].forEach(key => {

      const id = 'a' + key;

      if ($(id)) {
        $(id).value =
          a[key] ?? '';
      }
    });
  }

  async function initialiseFirebase() {

    try {

      status(
        'Connecting to Firebase…'
      );

      if (!window.firebaseConfig) {
        throw new Error(
          'firebase-config.js did not load.'
        );
      }

      if (typeof firebase === 'undefined') {
        throw new Error(
          'Firebase library did not load.'
        );
      }

      const app =
        firebase.apps.length
          ? firebase.app()
          : firebase.initializeApp(
              window.firebaseConfig
            );

      auth = app.auth();

      db = app.firestore();

      await auth.signInAnonymously();

      user = auth.currentUser;

      if (!user) {
        throw new Error(
          'Anonymous authentication failed.'
        );
      }

      status(
        'Connected to Firebase.'
      );

    } catch (e) {

      console.error(
        'FIREBASE STARTUP ERROR:',
        e
      );

      status(
        'Firebase connection error: ' +
        e.message,
        true
      );
    }
  }

  function watchGame() {

    if (unsub) {
      unsub();
    }

    unsub =
      db
        .collection('games')
        .doc(gameId)
        .onSnapshot(
          snapshot => {

            if (!snapshot.exists) {

              status(
                'That game does not exist yet.',
                true
              );

              return;
            }

            gameData =
              snapshot.data();

            loadActualInputs();

            buildPlayerInputs();

            renderRankings();

            $('gameTitle').textContent =
              `${gameData.awayTeam || 'Away'} @ ${
                gameData.homeTeam || 'Home'
              }`;

            status(
              'Game live — results update automatically.'
            );
          },

          e => {

            console.error(e);

            status(
              'Firestore error: ' +
              e.message,
              true
            );
          }
        );
  }

  $('adminBtn').onclick =
    () => {

      hide('join');
      hide('player');
      show('admin');
    };

  $('adminBackBtn').onclick =
    () => {

      hide('admin');
      show('join');
    };

  $('changeBtn').onclick =
    () => {

      if (unsub) {
        unsub();
      }

      hide('player');
      show('join');
    };

  $('createGameBtn').onclick =
    async () => {

      try {

        if (!db || !user) {

          throw new Error(
            'Firebase is not connected yet. Refresh and try again.'
          );
        }

        gameId =
          $('gameCode')
            .value
            .trim()
            .toUpperCase();

        const code =
          $('adminCode').value;

        const home =
          $('homeTeam')
            .value
            .trim();

        const away =
          $('awayTeam')
            .value
            .trim();

        if (
          !gameId ||
          !code ||
          !home ||
          !away
        ) {

          throw new Error(
            'Enter the game code on the opening screen, admin code, home team and away team.'
          );
        }

        const ref =
          db
            .collection('games')
            .doc(gameId);

        const snap =
          await ref.get();

        if (snap.exists) {

          gameData =
            snap.data();

          if (
            gameData.adminCode !== code
          ) {

            throw new Error(
              'Incorrect admin code for this game.'
            );
          }

        } else {

          await ref.set({

            homeTeam: home,

            awayTeam: away,

            adminCode: code,

            actual: {},

            players: {},

            createdAt:
              new Date().toISOString()

          });

          gameData =
            (
              await ref.get()
            ).data();
        }

        show('actuals');

        buildPlayerInputs();

        loadActualInputs();

        renderRankings();

        watchGame();

        status(
          'Game loaded. Enter the eight players and their guesses.'
        );

      } catch (e) {

        console.error(e);

        status(
          e.message ||
          'Could not create/load game.',
          true
        );
      }
    };

  $('saveActualsBtn').onclick =
    async () => {

      try {

        const actual =
          actualsFromInputs();

        const clean = {};

        cats.forEach(
          ([id]) => {

            const v =
              actual[id];

            const valid =
              Array.isArray(v)
                ? v.every(
                    x => Number.isFinite(x)
                  )
                : Number.isFinite(v);

            if (valid) {
              clean[id] = v;
            }
          }
        );

        if (
          !Object.keys(clean).length
        ) {

          throw new Error(
            'Enter at least one actual result.'
          );
        }

        await db
          .collection('games')
          .doc(gameId)
          .set(
            { actual: clean },
            { merge: true }
          );

        gameData.actual = {
          ...(gameData.actual || {}),
          ...clean
        };

        renderRankings();

        status(
          'Actual results saved. Rankings updated.'
        );

      } catch (e) {

        console.error(e);

        status(
          e.message ||
          'Could not save actual results.',
          true
        );
      }
    };

  initialiseFirebase();

})();
