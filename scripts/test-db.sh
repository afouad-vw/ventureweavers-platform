#!/usr/bin/env bash
# Runs the migrations and access tests on a throwaway local Postgres.
set -euo pipefail
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | tail -1)}"
DIR="$(mktemp -d)"
PORT="${PG_PORT:-55432}"
trap '"$BIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$BIN/initdb" -D "$DIR" -U postgres --auth=trust >/dev/null
"$BIN/pg_ctl" -D "$DIR" -o "-p $PORT -k $DIR" -l "$DIR/log" start >/dev/null
PSQL=(psql -h "$DIR" -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q -t -A)
"${PSQL[@]}" -c "create database t"
"${PSQL[@]}" -d t -f supabase/tests/stub_supabase.sql
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d t -f "$f"; done
for f in supabase/tests/access.sql supabase/tests/events.sql supabase/tests/content.sql supabase/tests/tvs.sql supabase/tests/classroom.sql supabase/tests/brickr.sql supabase/tests/contacts.sql supabase/tests/live.sql supabase/tests/payments.sql supabase/tests/notifications.sql supabase/tests/details.sql supabase/tests/signup.sql supabase/tests/contact_admin.sql supabase/tests/admin_team.sql; do
  "${PSQL[@]}" -d t -f "$f" 2>&1 | sed 's/^psql:[^:]*:[0-9]*: NOTICE:  /  /'
  [ "${PIPESTATUS[0]}" = "0" ] || exit 1
done
bash supabase/tests/race.sh "${PSQL[@]}" -d t
# Seed files must load cleanly too.
for f in supabase/seed/*.sql; do [ -e "$f" ] && "${PSQL[@]}" -d t -f "$f"; done
"${PSQL[@]}" -d t -c "select count(*) || ' modules, ' || (select count(*) from public.module_steps) || ' steps, ' || (select count(*) from public.assignments) || ' assignments seeded' from public.modules"
echo "SEED OK"
