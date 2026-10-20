# Raheem Ludo — Firestore Security Specification

## 1. Data Invariants
1. **Zero PII Exposure**: `/public_profiles/{userId}` stores only non-PII game metadata (`uid`, `playerCode`, `displayName`, `avatarColor`, `presenceStatus`, `friendUids`, `createdAt`, `updatedAt`). No emails, phone numbers, or addresses are stored in Firestore.
2. **Identity Integrity**: A `public_profiles/{userId}` document can only be created or updated when `userId == request.auth.uid` and `incoming().uid == request.auth.uid`.
3. **Temporal Integrity**: `createdAt` is immutable on update and must equal `request.time` on create; `updatedAt` must equal `request.time` on both create and update.
4. **Terminal State Locking**: Once a `/rooms/{roomId}` document reaches `status == 'FINISHED'`, no further updates are permitted.

## 2. The "Dirty Dozen" Payloads (Rejected with PERMISSION_DENIED)
1. Unauthenticated write to `/public_profiles/user_1`
2. Authenticated user with `email_verified == false` attempting to create `/public_profiles/user_1`
3. Authenticated user `user_1` attempting to create `/public_profiles/user_2` (ID mismatch)
4. Shadow field injection `{ isAdmin: true }` into `/public_profiles/user_1`
5. Oversized `displayName` (> 32 chars) in `/public_profiles/user_1`
6. Invalid `avatarColor` (`"PURPLE"`) not in `['RED', 'GREEN', 'YELLOW', 'BLUE']`
7. Client-spoofed `createdAt` timestamp not matching `request.time`
8. Mutating immutable `createdAt` or `uid` during an update to `/public_profiles/user_1`
9. Creating a `/rooms/{roomId}` where `hostUid != request.auth.uid`
10. Updating a `/rooms/{roomId}` after `resource.data.status == 'FINISHED'` (Terminal State Lock violation)
11. Injecting a 1.5KB junk document ID into `/rooms/{roomId}`
12. Deleting another player's `/public_profiles/{userId}` document
