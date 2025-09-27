# Database Credentials for facnet-validator

## PostgreSQL Database Setup

**Database Name:** `dashvalidator`
**Username:** `dashvalidator_user`
**Password:** `dashvalidator123!`
**Host:** `localhost`
**Port:** `5432`

## Connection String
```
DATABASE_URL=postgresql://dashvalidator_user:dashvalidator123!@localhost:5432/dashvalidator
```

## Setup Instructions
1. The database was created using the `setup-db.sql` script
2. Run the script as a PostgreSQL superuser to set up the database and user
3. The user has full privileges on the dashvalidator database

## Security Note
- Keep this file secure and do not commit it to version control
- Consider adding `database-credentials.md` to your `.gitignore` file