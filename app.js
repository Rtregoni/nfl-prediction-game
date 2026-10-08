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

  function setStatus(message, error = false) {
    const el = $('status');
    el.textContent = message;
    el.className = 'status ' + (error ? 'error' : 'ok');
  }

  function show(id) {
    $(id).classList.remove('hidden');
  }

  function hide(id) {
    $(id).classList.add('hidden');
  }

  function num(id) {
    const value = $(id).value;
    return value === '' ? null : Number(value);
  }

  function predictions() {
    return {
      q1: [num('q1h'), num('q1a')],
      ht: [num('hth'), num('hta')],
      q3: [num('q3h'), num('q3a')],
      final: [num('fh'), num('fa')],
      attendance: num('attendance'),
      rush: num('rush'),
      pass: num('pass'),
      fg: num('fg')
    };
  }

  function actuals() {
    return {
      q1: [num('aq1h'), num('aq1a')],
      ht: [num('ahth'), num('ahta')],
      q3: [num('aq3h'), num('aq3a')],
      final: [num('afh'), num('afa')],
      attendance: num('aattendance'),
      rush: num('arush'),
      pass: num('apass'),
      fg: num('afg')
    };
  }

  function complete(p) {
    return cats.every(([id]) => {
      const value = p[id];

      if (Array.isArray(value)) {
        return value.every(x => Number.isFinite(x));
      }

      return Number.isFinite(value);
    });
  }

  function distance(prediction, actual, type) {
    if (type === 'score') {
      return Math.abs(prediction[0] - actual[0]) +
             Math.abs(prediction[1] - actual[1]);
    }

    return Math.abs(prediction - actual);
  }

  function getWinners() {
    const results = [];

    if (!gameData || !gameData.actual || !gameData.players) {
      return results;
    }

    for (const [id, label, type] of cats) {
      const actual = gameData.actual[id];

      if (
        actual == null ||
        (Array.isArray(actual) && actual.some(x => x == null))
      ) {
        continue;
      }

      const eligible = Object.values(gameData.players)
        .filter(player =>
          player.submitted &&
          player.predictions &&
          player.predictions[id] != null
        );

      if (!eligible.length) continue;

      let best = Infinity;

      eligible.forEach(player => {
        const d = distance(
          player.predictions[id],
          actual,
          type
        );

        if (d < best) best = d;
      });

      const winners = eligible
        .filter(player =>
          distance(player.predictions[id], actual, type) === best
        )
        .map(player => player.playerName);

      results.push({
        id,
        label,
        type,
        actual,
        best,
        winners
      });
    }

    return results;
  }

  function formatValue(value, type) {
    if (type === 'score') {
      return value[0] + ' – ' + value[1];
    }

    return value + (type === 'yards' ? ' yards' : '');
  }

  function renderWinners(target) {
    const results = getWinners();

    if (!results.length) {
      $(target).innerHTML =
        '<h3>Winners</h3>' +
        '<p class="note">Waiting for actual results and submitted predictions.</p>';
      return;
    }

    $(target).innerHTML =
      '<h3>Winners</h3>' +
      results.map(result => `
        <div class="winner">
          <strong>${result.label}</strong>
          <span>Actual: ${formatValue(result.actual, result.type)}</span>
          <b>${result.winners.join(' & ')}</b>
          ${result.best === 0 ? '<em>Exact prediction!</em>' : ''}
        </div>
      `).join('');
  }

  function renderGame() {
    if (!gameData) return;

    $('gameTitle').textContent =
      `${gameData.awayTeam || 'Away'} @ ${gameData.homeTeam || 'Home'}`;

    renderWinners('playerWinners');
    renderWinners('adminWinners');

    const mine = gameData.players?.[user?.uid];

    if (mine?.submitted) {
      [
        ...$('predictionForm').querySelectorAll('input'),
        $('submitBtn')
      ].forEach(element => {
        element.disabled = true;
      });

      show('lockMsg');
    } else {
      [
        ...$('predictionForm').querySelectorAll('input'),
        $('submitBtn')
      ].forEach(element => {
        element.disabled = false;
      });

      hide('lockMsg');
    }
  }

  async function initialiseFirebase() {
    try {
      setStatus('Connecting to Firebase…');

      if (!window.firebaseConfig) {
        throw new Error(
          'firebase-config.js did not load. Check that the file exists in the GitHub repository.'
        );
      }

      if (!window.firebaseConfig.apiKey) {
        throw new Error(
          'Firebase configuration is missing the API key.'
        );
      }

      if (!window.firebaseConfig.projectId) {
        throw new Error(
          'Firebase configuration is missing the project ID.'
        );
      }

      if (typeof firebase === 'undefined') {
        throw new Error(
          'The Firebase JavaScript library did not load.'
        );
      }

      const app = firebase.initializeApp(window.firebaseConfig);

      auth = app.auth();
      db = app.firestore();

      await auth.signInAnonymously();

      user = auth.currentUser;

      if (!user) {
        throw new Error(
          'Firebase anonymous authentication did not return a user.'
        );
      }

      setStatus('Connected to Firebase.');

    } catch (error) {
      console.error('FIREBASE STARTUP ERROR:', error);

      setStatus(
        'Firebase connection error: ' + error.message,
        true
      );
    }
  }

  function watchGame() {
    if (unsub) unsub();

    unsub = db
      .collection('games')
      .doc(gameId)
      .onSnapshot(
        snapshot => {
          if (!snapshot.exists) {
            setStatus('Game not found.', true);
            return;
          }

          gameData = snapshot.data();

          renderGame();

          setStatus(
            'Game live — updates appear automatically.'
          );
        },
        error => {
          console.error('FIRESTORE ERROR:', error);

          setStatus(
            'Firestore error: ' + error.message,
            true
          );
        }
      );
  }

  $('joinBtn').onclick = async function () {
    try {
      if (!db || !user) {
        setStatus(
          'Firebase is still connecting. Please wait a moment and try again.',
          true
        );
        return;
      }

      gameId = $('gameCode').value.trim().toUpperCase();
      const name = $('playerName').value.trim();

      if (!gameId || !name) {
        setStatus(
          'Enter a game code and your name.',
          true
        );
        return;
      }

      const ref = db.collection('games').doc(gameId);
      const snapshot = await ref.get();

      if (!snapshot.exists) {
        setStatus(
          'That game code does not exist yet.',
          true
        );
        return;
      }

      gameData = snapshot.data();

      await ref.set(
        {
          players: {
            [user.uid]: {
              playerName: name,
              predictions:
                gameData.players?.[user.uid]?.predictions || {},
              submitted:
                gameData.players?.[user.uid]?.submitted || false
            }
          }
        },
        { merge: true }
      );

      $('playingAs').textContent = name;

      hide('join');
      hide('admin');
      show('player');

      watchGame();

    } catch (error) {
      console.error('JOIN ERROR:', error);

      setStatus(
        'Could not join game: ' + error.message,
        true
      );
    }
  };

  $('predictionForm').onsubmit = async function (event) {
    event.preventDefault();

    try {
      const p = predictions();

      if (!complete(p)) {
        setStatus(
          'Please complete every prediction.',
          true
        );
        return;
      }

      await db
        .collection('games')
        .doc(gameId)
        .set(
          {
            players: {
              [user.uid]: {
                playerName: $('playingAs').textContent,
                predictions: p,
                submitted: true,
                submittedAt: new Date().toISOString()
              }
            }
          },
          { merge: true }
        );

      setStatus('Predictions submitted and locked.');

    } catch (error) {
      console.error('PREDICTION ERROR:', error);

      setStatus(
        'Could not submit predictions: ' + error.message,
        true
      );
    }
  };

  $('adminBtn').onclick = function () {
    hide('join');
    hide('player');
    show('admin');
  };

  $('adminBackBtn').onclick = function () {
    hide('admin');
    show('join');
  };

  $('changeBtn').onclick = function () {
    if (unsub) unsub();

    hide('player');
    show('join');
  };

  $('createGameBtn').onclick = async function () {
    try {
      if (!db || !user) {
        setStatus(
          'Firebase is not connected.',
          true
        );
        return;
      }

      gameId = $('gameCode').value.trim().toUpperCase();

      const code = $('adminCode').value;
      const home = $('homeTeam').value.trim();
      const away = $('awayTeam').value.trim();

      if (!gameId || !code || !home || !away) {
        setStatus(
          'Enter game code, admin code and both teams.',
          true
        );
        return;
      }

      const ref = db.collection('games').doc(gameId);
      const snapshot = await ref.get();

      if (snapshot.exists) {
        gameData = snapshot.data();

        if (gameData.adminCode !== code) {
          setStatus(
            'Incorrect admin code for this game.',
            true
          );
          return;
        }

      } else {
        await ref.set({
          homeTeam: home,
          awayTeam: away,
          adminCode: code,
          actual: {},
          players: {},
          createdAt: new Date().toISOString()
        });

        gameData = (await ref.get()).data();
      }

      show('actuals');

      watchGame();

      renderGame();

      setStatus('Game loaded.');

    } catch (error) {
      console.error('ADMIN ERROR:', error);

      setStatus(
        'Could not create/load game: ' + error.message,
        true
      );
    }
  };

  $('saveActualsBtn').onclick = async function () {
    try {
      const actual = actuals();
      const clean = {};

      Object.entries(actual).forEach(([key, value]) => {
        const valid = Array.isArray(value)
          ? value.every(x => Number.isFinite(x))
          : Number.isFinite(value);

        if (valid) {
          clean[key] = value;
        }
      });

      await db
        .collection('games')
        .doc(gameId)
        .set(
          { actual: clean },
          { merge: true }
        );

      setStatus('Actual results saved.');

    } catch (error) {
      console.error('RESULT ERROR:', error);

      setStatus(
        'Could not save actual results: ' + error.message,
        true
      );
    }
  };

  initialiseFirebase();

})();
