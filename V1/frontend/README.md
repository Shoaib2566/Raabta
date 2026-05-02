# Raabta Frontend

Static frontend package for the Raabta platform.

## Structure

```text
raabta-frontend/
├── index.html
├── css/
│   └── styles.css
├── js/
│   └── app.js
└── assets/
    └── images/
```

## What was cleaned/fixed

- Replaced separate **Log In** and **Sign Up** buttons in the landing navbar with one **Login / Sign Up** button.
- Fixed the mobile landing navbar so it no longer looks cramped on phones.
- Removed the bottom preview/dashboard switcher from the production ZIP.
- Split the single HTML preview into proper frontend folders for GitHub/backend handoff.

## Backend integration notes

The UI is currently static/demo-mode. The main places backend developers will connect are:

- `authLogin()` and `authSignup()` in `js/app.js`
- New order submission in the customer dashboard
- Complaint submission in `submitComplaint()`
- Admin service add/edit/enable/disable flows
- Supervisor assignment/status update flows

If needed, define the API base URL before `js/app.js` loads:

```html
<script>window.API_BASE_URL = "https://your-api-domain.com/api";</script>
<script src="js/app.js"></script>
```

## Run locally

Open `index.html` directly in a browser, or use a static server such as VS Code Live Server.
