# NFL Game Day Predictions — setup

## 1. Firebase
Create a Firebase project, register a Web app, create Cloud Firestore, and enable Authentication > Sign-in method > Anonymous.

## 2. Firebase config
Open `firebase-config.js` and replace every PASTE_* value with the Web App config Firebase gives you.

## 3. Firestore rules
In Firebase Console > Firestore Database > Rules, paste the contents of `firestore.rules` and publish.

## 4. GitHub
Create a GitHub repository called `nfl-prediction-game` and upload all five files. Enable Settings > Pages > Deploy from a branch > main > /(root).

## 5. First game
Open the published page, choose Admin / enter actual results, enter a code such as LONDON26 and team names, and create the game. Share the URL and code with the seven other players.

## 6. Game play
Players submit their eight predictions before the game. The admin enters actual results progressively. Each category displays the closest prediction or joint winners. There are no points or overall ranking.

## Important security note
This starter build uses anonymous authentication so players do not need accounts. The admin screen is therefore not yet restricted to one person. For a private eight-person game this is convenient, but before making the app public, add a proper admin authentication/role system.
