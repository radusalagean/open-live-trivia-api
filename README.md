[![Build Status](https://travis-ci.org/radusalagean/open-live-trivia-app-android.svg?branch=master)](https://travis-ci.org/radusalagean/open-live-trivia-app-android)
# open-live-trivia-api
**Open Live Trivia** is an open-source multiplayer trivia game. This repo hosts the server-side part of the project. For the corresponding client app, please check [this](https://github.com/radusalagean/open-live-trivia-app-android) link.

## Overview
### Game rules
- An entry is displayed every round
- Every player has 3 free attempts to submit the correct answer
- Additional attempts will cost 1 coin
- The answers are case insensitive, but must have all the characters contained in the answer in order to be considered correct
- Every 15 seconds, a new character is revealed from the answer
- Clues range from 10 to 100 coins in value (based on their difficulty)
- Their value decreases as more characters are revealed

### Other features
- Users are able to request the game leaderboard
- There are 3 right levels that a user can have:
  - *Regular* - type `0`
  - *Moderator* - type `1`
  - *Admin* - type `2`
- Users are able to report entries which they consider invalid / inappropriate while playing. Those can be reviewed later and then banned / dismissed by *moderators* or the *admin*.
- The *admin* is the only one able to grant or revoke extra rights to users
- All registered users are able to delete their accounts permanently

![Use Case Diagram](diagrams/use-case.png)

## Under the hood
### Authentication
Player authentication is achieved through [Firebase Auth](https://firebase.google.com/docs/auth/). The client app will send a token to the server that is valid for **one hour**. That token is automatically refreshed by the client app when needed, so tokens sent to the server should always be up to date. Upon receiving an authorized request from the client app, the server sends that token through [Firebase Admin](https://www.npmjs.com/package/firebase-admin) in order to receive a decrypted payload that contains necessary info such as `uid` (an unique id associated with the Google Account used to authenticate) and the `exp` field (the expiration date of the currently used token). The following activity diagram showcases the authentication flow:

![Activity Diagram for Authentication](diagrams/authentication-activity.png)
[View the full resolution version](https://raw.githubusercontent.com/radusalagean/open-live-trivia-api/master/diagrams/authentication-activity.png)

### Game
The communication of game-specific events between the server and the client is based on [socket.io](https://socket.io). This approach facilitates real-time bidirectional communication between the two systems, which is ideal for the purpose of an online multiplayer game. The following activity diagram showcases the flow of game-specific events between the client and the server, based on the rules mentioned above:

![Activity Diagram for the Game](diagrams/game-activity.png)
[View the full resolution version](https://raw.githubusercontent.com/radusalagean/open-live-trivia-api/master/diagrams/game-activity.png)
