#!/bin/sh
set -e

echo "🏈 ADP Scout — Starting up..."

# Run pending database migrations
echo "  Running database migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma
echo "  ✅ Migrations applied"

# Hand off to CMD (default: node server.js)
echo "  🚀 Starting server..."
exec "$@"
