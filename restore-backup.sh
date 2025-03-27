#!/bin/bash

set -e

cleanup() {
    echo "Cleaning up..."
    if [ -n "$TMP_DIR" ] && [ -d "$TMP_DIR" ]; then
        rm -rf "$TMP_DIR"
    fi
    docker compose stop
    echo "ℹ Reminder: Make sure to restart the stopped services through the ansible playbook. ⚠ Do not run 'docker compose up' from the server command line."
}

if [ $# -ne 1 ]; then
    echo "Usage: $0 <backup-file>"
    echo "Supports both encrypted (*.tar.gz.gpg) and unencrypted (*.tar.gz) backup files"
    exit 1
fi

read -p "Warning! This script will remove existing data for this website. Continue? y/N " response
if [[ ! "$response" =~ ^[Yy]$ ]]; then
    echo "Operation cancelled."
    exit 1
fi

trap cleanup EXIT

cd "$(dirname "$0")"

BACKUP_FILE="$1"
TMP_DIR=$(mktemp -d)

# Handle GPG decryption if needed
if [[ "$BACKUP_FILE" == *.gpg ]]; then
    if ! command -v gpg &> /dev/null; then
        echo "Error: gpg is required for decrypting backups but not found"
        exit 1
    fi
    
    read -s -p "Enter GPG decryption password: " GPG_PASSWORD
    echo
    
    DECRYPTED_FILE="$TMP_DIR/$(basename "$BACKUP_FILE" .gpg)"
    
    echo "Decrypting backup file..."
    echo "$GPG_PASSWORD" | gpg --batch --passphrase-fd 0 \
        -o "$DECRYPTED_FILE" \
        -d "$BACKUP_FILE" || { echo "Decryption failed"; exit 1; }
    
    BACKUP_PATH="$DECRYPTED_FILE"
else
    BACKUP_PATH=$(realpath "$BACKUP_FILE")
fi

# Check if backup file exists
if [ ! -f "$BACKUP_PATH" ]; then
    echo "Backup file $BACKUP_PATH does not exist."
    exit 1
fi

VOLUMES=(
    open-live-trivia-public-assets
    open-live-trivia-db-dump
    open-live-trivia-db
)

echo "Stopping services..."
docker compose stop

echo "Clearing volumes..."
for volume in "${VOLUMES[@]}"; do
    docker run --rm -v "$volume":/volume alpine sh -c 'rm -rf /volume/*'
done

echo "Restoring volumes from backup..."
# Restore Public Assets volume
docker run --rm \
    -v open-live-trivia-public-assets:/volume \
    -v "$BACKUP_PATH":/backup.tar.gz:ro \
    alpine sh -c 'tar -xzf /backup.tar.gz -C /volume --strip-components=2 backup/public'

# Restore DB dump volume
docker run --rm \
    -v open-live-trivia-db-dump:/volume \
    -v "$BACKUP_PATH":/backup.tar.gz:ro \
    alpine sh -c 'tar -xzf /backup.tar.gz -C /volume --strip-components=2 backup/db'

echo "Starting database container..."
docker compose up -d open-live-trivia-db

echo "Waiting for MongoDB to be ready..."

until docker exec open-live-trivia-db \
    sh -c 'mongosh -u $MONGO_INITDB_ROOT_USERNAME -p $(cat $MONGO_INITDB_ROOT_PASSWORD_FILE) --authenticationDatabase admin --eval "db.runCommand({ ping: 1 })">/dev/null 2>&1'; do
    sleep 1
done

echo "Importing database dump..."
docker exec open-live-trivia-db \
    sh -c 'mongorestore -u $MONGO_INITDB_ROOT_USERNAME -p $(cat $MONGO_INITDB_ROOT_PASSWORD_FILE) --authenticationDatabase admin --archive=/db-dump/dump.archive'

echo "Restore completed successfully!"