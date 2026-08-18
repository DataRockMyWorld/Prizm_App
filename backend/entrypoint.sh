#!/bin/sh
set -e

echo "Waiting for postgres at ${POSTGRES_HOST:-db}:${POSTGRES_PORT:-5432}..."
until python -c "
import socket, sys, os
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
try:
    s.connect((os.environ.get('POSTGRES_HOST', 'db'), int(os.environ.get('POSTGRES_PORT', 5432))))
except Exception:
    sys.exit(1)
"; do
  sleep 1
done
echo "Postgres is up."

case "$1" in
  web)
    python manage.py migrate --noinput
    exec python manage.py runserver 0.0.0.0:8000
    ;;
  celery)
    exec celery -A config worker -l info
    ;;
  *)
    exec "$@"
    ;;
esac
