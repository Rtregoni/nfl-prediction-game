# NFL Game Day Predictions — fixed version

This version removes the browser-module import from the app and loads Firebase's CDN compat SDK directly in index.html. Firebase documents this CDN approach for simple sites without a build tool.

## 1. Replace the files in GitHub
Replace index.html, app.js, style.css, firebase-config.js and firestore.rules with these files.

## 2. Firebase config
Open firebase-config.js and replace the placeholder values with the exact Web App configuration from Firebase Console.

## 3. Firebase Authentication
Enable Authentication > Sign-in method > Anonymous.

## 4. Firestore
Create a Firestore database and publish firestore.rules.

## 5. GitHub Pages
Commit the files and wait for GitHub Pages to redeploy.

## 6. Test
Open the Pages URL, wait for the green “Connected to Firebase” message, then use Admin to create a game.

IMPORTANT: the starter rules are intentionally simple for a private friends' game. They do not securely restrict admin writes. Before using this as a public app, add proper admin authentication and tighter Firestore rules.
