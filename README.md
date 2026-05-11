# Simple CRM

A lightweight browser-based CRM with a private login, server-side storage, and separate workflows for sales conversations and non-sales relationships.

## Features

- Separate sales pipeline and non-sales relationship tracking
- Contact records with type, warmth, priority, notes, and next action
- Pipeline stages from new lead to won/lost
- Today view for overdue or due-now follow-ups
- Search plus filters for sales vs relationships
- Private password-protected login
- Persistent server-side storage with SQLite
- JSON import/export for quick backups

## Run it

From this folder run:

```bash
CRM_PASSWORD=your-password python3 app.py
```

Then visit `http://localhost:8000`.

## Deploy on Render

This app is ready to deploy as a Python web service on Render with a persistent disk.

Files used:

- [`render.yaml`](/Users/sarahkemp/Documents/New%20project/simple-crm/render.yaml)
- [`app.py`](/Users/sarahkemp/Documents/New%20project/simple-crm/app.py)

Recommended setup:

1. Push this folder to its own GitHub repo.
2. In Render, create a new `Blueprint` deployment from that repo, or create a `Web Service` manually.
3. If creating it manually, use:
   - Runtime: `Python`
   - Build command: leave blank
   - Start command: `python3 app.py`
4. Add a persistent disk mounted at `/var/data`.
5. Add an environment variable called `CRM_PASSWORD` with a private password you will remember.
6. Once Render gives you a `.onrender.com` URL, log in and test the app there.
7. In Render, open `Settings` then `Custom Domains` and add the domain you want to use.
8. Update your DNS records where your domain is managed using the exact values Render shows you.

Notes:

- Your data is now stored server-side in SQLite, so it syncs across devices as long as they use the same deployed app.
- If you later want email login, multiple users, or a hosted Postgres database, this backend can be upgraded again without redesigning the app.
