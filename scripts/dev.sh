#!/usr/bin/env bash
# SupaSaaSy Local Development Script
# This script helps set up and run the local development environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Print colored message
info() { echo -e "${GREEN}[INFO]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Check if supabase CLI is installed
check_supabase() {
    if ! command -v supabase &> /dev/null; then
        error "Supabase CLI is not installed."
        echo "Install it with: brew install supabase/tap/supabase"
        echo "Or see: https://supabase.com/docs/guides/cli"
        exit 1
    fi
    info "Supabase CLI found: $(supabase --version)"
}

# Check if .env.local exists
check_env() {
    if [ ! -f .env.local ]; then
        warn ".env.local not found. Creating from template..."
        cp .env.local.example .env.local
        info "Created .env.local - please review and update as needed"
    fi
}

# Start Supabase local stack
start() {
    info "Starting Supabase local development stack..."
    supabase start

    echo ""
    info "Local development environment is ready!"
    echo ""
    echo "  Studio URL:    http://127.0.0.1:54323"
    echo "  API URL:       http://127.0.0.1:54321"
    echo "  DB URL:        postgresql://postgres:postgres@127.0.0.1:54322/postgres"
    echo ""
    echo "To serve Edge Functions locally:"
    echo "  supabase functions serve"
    echo ""
    echo "To stop the local stack:"
    echo "  supabase stop"
}

# Stop Supabase local stack
stop() {
    info "Stopping Supabase local development stack..."
    supabase stop
    info "Local stack stopped"
}

# Reset database (run migrations from scratch)
reset() {
    warn "This will reset your local database. All data will be lost."
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        info "Resetting database..."
        supabase db reset
        info "Database reset complete"
    else
        info "Reset cancelled"
    fi
}

# Run database migrations
migrate() {
    info "Running database migrations..."
    supabase db push
    info "Migrations complete"
}

# Show help
usage() {
    echo "SupaSaaSy Development Script"
    echo ""
    echo "Usage: ./scripts/dev.sh <command>"
    echo ""
    echo "Commands:"
    echo "  start     Start the local Supabase stack"
    echo "  stop      Stop the local Supabase stack"
    echo "  reset     Reset the local database (destructive)"
    echo "  migrate   Run database migrations"
    echo "  help      Show this help message"
}

# Main
check_supabase

case "${1:-start}" in
    start)
        check_env
        start
        ;;
    stop)
        stop
        ;;
    reset)
        reset
        ;;
    migrate)
        migrate
        ;;
    help|--help|-h)
        usage
        ;;
    *)
        error "Unknown command: $1"
        usage
        exit 1
        ;;
esac
