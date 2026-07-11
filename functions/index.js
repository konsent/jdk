const { onDocumentWritten } = require("firebase-functions/v2/firestore");

exports.notifyOnPendingSignup = onDocumentWritten("users/{uid}", async (event) => {
  // Task 2에서 구현
});
