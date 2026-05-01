# EduLink Africa

A Vite React app for registering African schools and giving each school a managed website page.

## Run locally

```bash
npm install
npm run dev
```

Demo public page: `/demo`

Demo admin page: `/demo/admin`

Login page: `/login`

Superadmin page: `/superadmin`

## Firebase setup

The project is configured for Firebase project `edulink-africa`. The local Vite Firebase config lives in `.env.local`. Enable Firestore and Email/Password authentication in Firebase Console before using admin sign-in.

Public school pages read from the `schools` collection, while the public URL is `edulink.africa/{schoolUrl}`. Admin saves write to `schools/{schoolUrl}`. Deploy `firestore.rules` so only approved signed-in admins can write.

When a school is registered, the registration form stores `adminEmails` on the school document. That email can create an account on `/login` and will be redirected to the school admin page.

To approve an admin, create a document at `schoolAdmins/{firebaseAuthUid}`:

```json
{
  "email": "admin@example.com",
  "schoolIds": ["demo"],
  "superAdmin": false
}
```

Use `"superAdmin": true` for platform admins who can manage every school.

After login, users are redirected by their `schoolAdmins/{uid}` profile or by a matching `adminEmails` entry on a school:

- `superAdmin: true` redirects to `/superadmin`
- normal admins redirect to the first school in `schoolIds`, for example `/demo/admin`
- school registration admins redirect to the school where their email is listed in `adminEmails`

The superadmin dashboard can search all schools, create a school from the demo template, edit any school, open the public page, open the school admin page, and simulate a selected school page beside the editor.

School admins manage content through section tabs: school profile, contact details, about, news, calendar, staff, classes, and students. Students must be assigned to a class, so at least one class must exist before students can be added.

Each school also has a public `/about` page, for example `/demo/about`. Schools can create their own about categories and pages from the About admin section.

## Deploy

```bash
npm run build
firebase deploy --only hosting,firestore:rules
```
# edulink-africa
