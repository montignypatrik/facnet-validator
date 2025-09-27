-- PostgreSQL setup script for facnet-validator
-- Run this as a superuser (postgres user)

-- Drop existing database if it exists
DROP DATABASE IF EXISTS dashvalidator;

-- Drop existing user if exists
DROP ROLE IF EXISTS dashvalidator_user;

-- Create new user with password
CREATE ROLE dashvalidator_user WITH
  LOGIN
  NOSUPERUSER
  CREATEDB
  NOCREATEROLE
  INHERIT
  NOREPLICATION
  CONNECTION LIMIT -1
  PASSWORD 'dashvalidator123!';

-- Create new database
CREATE DATABASE dashvalidator
  WITH
  OWNER = dashvalidator_user
  ENCODING = 'UTF8'
  CONNECTION LIMIT = -1;

-- Grant all privileges on database to user
GRANT ALL PRIVILEGES ON DATABASE dashvalidator TO dashvalidator_user;

-- Connect to the new database and grant schema privileges
\c dashvalidator;
GRANT ALL ON SCHEMA public TO dashvalidator_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dashvalidator_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dashvalidator_user;

-- Display success message
SELECT 'Database setup completed successfully!' as status;
SELECT 'Username: dashvalidator_user' as credentials;
SELECT 'Password: dashvalidator123!' as password;
SELECT 'Database: dashvalidator' as database_name;