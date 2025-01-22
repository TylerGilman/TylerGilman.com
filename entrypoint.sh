#!/bin/sh
set -e

# Initialize database if missing
if [ ! -f "/app/blog.db" ]; then
    touch "/app/blog.db"
    chmod 666 "/app/blog.db"
    echo "Created new database file"
fi

exec "$@"
