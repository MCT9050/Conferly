# Backup Strategy for Conferly

## Database Backup

### SQLite (Development/Default)
```bash
# Manual backup
sqlite3 conferly.db ".backup conferly_backup.db"

# Automate with cron (daily at 2am)
0 2 * * * sqlite3 /data/conferly.db ".backup /backups/conferly_$(date +\%Y\%m\%d).db"
```

### PostgreSQL (Production)
```bash
# Automated daily backup with pg_dump
0 2 * * * pg_dump -Fc conferly > /backups/conferly_$(date +\%Y\%m\%d).dump

# Point-in-time recovery (PITR) with wal archiving
```

## Encryption at Rest
- SQLCipher for SQLite (set DB_ENCRYPTION_KEY)
- PostgreSQL with pgcrypto extension

## Backup Rotation
- Keep last 7 daily backups
- Keep last 4 weekly backups
- Keep last 12 monthly backups

## Verification
```bash
# Verify SQLite backup
sqlite3 conferly_backup.db "PRAGMA integrity_check;"

# Verify PostgreSQL backup
pg_restore -t users conferly_backup.dump > /dev/null
```

## Offsite Backup
- Push to S3/Blob storage daily
- Replicate across regions
