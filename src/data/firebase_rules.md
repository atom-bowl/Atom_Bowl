# Firebase Rules (Suggested)

Use these as a starting point for Firestore rules to protect account data.

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
      match /{document=**} {
        allow read, write: if request.auth != null && request.auth.uid == userId;
      }
    }
  }
}
```

Notes:
- Keep your existing buzzer room rules as-is if you need public room discovery.
- If you want to lock rooms down, add a separate `match /rooms/{roomId}` block with stricter checks.
