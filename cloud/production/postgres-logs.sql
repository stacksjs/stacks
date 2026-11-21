-- Retain every record while rotating server logs onto the persistent volume.
-- logging_collector requires a controlled PostgreSQL service restart.
ALTER SYSTEM SET logging_collector = on;
ALTER SYSTEM SET log_directory = '/var/lib/stacks-deployments/postgresql-logs';
ALTER SYSTEM SET log_filename = 'postgresql-%Y-%m-%d_%H%M%S.log';
ALTER SYSTEM SET log_rotation_age = '1d';
ALTER SYSTEM SET log_rotation_size = '10MB';
ALTER SYSTEM SET log_truncate_on_rotation = off;
