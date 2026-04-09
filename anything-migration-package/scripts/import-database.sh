#!/bin/bash
# =============================================================================
# DATABASE IMPORT SCRIPT
# Imports your production database into your new Neon database
# =============================================================================
# 
# BEFORE RUNNING:
# 1. Make sure you have psql installed on your computer
#    - Mac: brew install postgresql
#    - Windows: Download from https://www.postgresql.org/download/windows/
#    - Linux: sudo apt-get install postgresql-client
#
# 2. Replace YOUR_CONNECTION_STRING below with your actual Neon connection string
#
# HOW TO RUN:
#    bash import-database.sh
# =============================================================================

NEON_CONNECTION_STRING="postgresql://neondb_owner:npg_QmVJzB5y6ufD@ep-damp-base-am5yli2o.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require"

echo "============================================"
echo "  Anything Property Management DB Import"
echo "============================================"
echo ""
echo "This will import your production database into Neon."
echo "Make sure production.sql is in the same folder as this script."
echo ""

# Check if production.sql exists
if [ ! -f "production.sql" ]; then
  echo "ERROR: production.sql not found in current directory."
  echo "Please place production.sql next to this script and try again."
  exit 1
fi

echo "Starting import... (this may take a few minutes for large databases)"
echo ""

psql "$NEON_CONNECTION_STRING" < production.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Database imported successfully!"
  echo ""
  echo "Next steps:"
  echo "  1. Go to your Neon dashboard and verify tables were created"
  echo "  2. Continue with the Vercel deployment"
else
  echo ""
  echo "❌ Import failed. Common fixes:"
  echo "  - Make sure psql is installed"
  echo "  - Check your internet connection"
  echo "  - Verify your Neon connection string is correct"
fi
