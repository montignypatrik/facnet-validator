import pkg from 'pg';
const { Client } = pkg;

async function createDatabase() {
  // Connect as postgres user to create new database and user
  const adminClient = new Client({
    user: 'postgres',
    host: 'localhost',
    database: 'postgres',
    port: 5432,
    password: 'postgres', // Try common default password
  });

  try {
    await adminClient.connect();
    console.log('Connected to PostgreSQL as admin user');

    // Drop existing database if it exists
    try {
      await adminClient.query('DROP DATABASE IF EXISTS dashvalidator;');
      console.log('Dropped existing database if it existed');
    } catch (error) {
      console.log('Database drop failed or database did not exist:', error.message);
    }

    // Drop existing user if it exists
    try {
      await adminClient.query('DROP ROLE IF EXISTS dashvalidator_user;');
      console.log('Dropped existing user if it existed');
    } catch (error) {
      console.log('User drop failed or user did not exist:', error.message);
    }

    // Create new user
    await adminClient.query(`
      CREATE ROLE dashvalidator_user WITH
        LOGIN
        NOSUPERUSER
        CREATEDB
        NOCREATEROLE
        INHERIT
        NOREPLICATION
        CONNECTION LIMIT -1
        PASSWORD 'dashvalidator123!';
    `);
    console.log('Created new user: dashvalidator_user');

    // Create new database
    await adminClient.query(`
      CREATE DATABASE dashvalidator
        WITH
        OWNER = dashvalidator_user
        ENCODING = 'UTF8'
        CONNECTION LIMIT = -1;
    `);
    console.log('Created new database: dashvalidator');

    // Grant privileges
    await adminClient.query('GRANT ALL PRIVILEGES ON DATABASE dashvalidator TO dashvalidator_user;');
    console.log('Granted privileges to user');

    await adminClient.end();

    // Now connect to the new database and grant schema privileges
    const dbClient = new Client({
      user: 'postgres',
      host: 'localhost',
      database: 'dashvalidator',
      port: 5432,
      password: 'postgres', // Try common default password
    });

    await dbClient.connect();
    await dbClient.query('GRANT ALL ON SCHEMA public TO dashvalidator_user;');
    await dbClient.query('GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO dashvalidator_user;');
    await dbClient.query('GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO dashvalidator_user;');
    console.log('Granted schema privileges');

    await dbClient.end();

    console.log('Database setup completed successfully!');
    console.log('Username: dashvalidator_user');
    console.log('Password: dashvalidator123!');
    console.log('Database: dashvalidator');

  } catch (error) {
    console.error('Error setting up database:', error);
  }
}

createDatabase();