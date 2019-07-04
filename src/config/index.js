export default {
    'port': 3006, // Port
    'socketAuthTimeout': 10 * 1000, // Duration of the period a user who just connected to the server socket has to authenticate, until he is disconnected automatically
    'mongoUrl': 'mongodb://localhost:27017/open-live-trivia-api', // The database url
    'bodyLimit': '100kb', // Max size of request bodies accepted
    'minAppVersionCode': 1, // The minimum version code of the client app (check on the app and show "update app" dialog if required)
    'usernameMaxLength': 50, // Max number of characters allowed for an username
    'freeStartingCoins': 100, // Free coins awarded upon account registration
    'userThumbnailSize': 150, // Max user thumbnail size, in px (will be applied to width and height)
    'publicRootDirectory': 'public', // The publicly accessible directory for static content
    'userThumbnailsDirectory': 'user-thumbnails', // The directory containing profile image thumbnails
    'splitInterval': 15 * 1000, // The duration of a split (milliseconds)
    'roundEndDelay': 8 * 1000, // The duration of a delay applied at the end of a round, until the next round starts (milliseconds)
    'excludedCharacters': new Set([' ', '"', '-', '(', ')', '.', ',', '&', '/']), // Characters that will always be shown in the answer
    'freeAttemptsPerRound': 3, // Number of free attempts per round that a player can use
    'extraAttemptCost': 1, // Cost of extra attempts (in in-game coins) sent by players after the free ones are used up
    'attemptStringMaxLength': 200, // Max number of characters allowed for an attempt
    'reportedEntriesPerPage': 10, // Max number of reported entries returned per page (on query requests)
    'usersPerPage': 20, // Max number of users returned per page (on leaderboard requests)
    'jServiceRetryInterval': 10 * 1000 // The delay in milliseconds for the next jService request retry if the previous one failed with an error
}