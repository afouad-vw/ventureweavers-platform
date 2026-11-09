#!/usr/bin/env bash
# Two members try to take the last seat at the same moment. Exactly one must succeed.
set -uo pipefail
PSQL=("$@")
"${PSQL[@]}" <<'SQL'
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'race1@test'), ('00000000-0000-0000-0000-0000000000c2', 'race2@test');
insert into public.events (id, slug, title, type, starts_at, venue, capacity, price_piasters, status)
values ('20000000-0000-0000-0000-000000000001', 'race-show', 'Race show', 'public_show', now() + interval '5 days', 'Cairo', 1, 1000, 'published');
SQL
book() { # $1 user, $2 delay before commit
  "${PSQL[@]}" -c "begin; set local role authenticated;
    select set_config('request.jwt.claims', '{\"sub\":\"$1\",\"role\":\"authenticated\"}', true);
    select public.book_event('20000000-0000-0000-0000-000000000001', 1); select pg_sleep($2); commit;" >/tmp/race_$1.log 2>&1
  echo $? > /tmp/race_$1.rc
}
book 00000000-0000-0000-0000-0000000000c1 2 &
sleep 0.5
book 00000000-0000-0000-0000-0000000000c2 0 &
wait
n=$("${PSQL[@]}" -c "select count(*) from public.bookings where event_id = '20000000-0000-0000-0000-000000000001' and status in ('reserved','confirmed')")
a=$(cat /tmp/race_00000000-0000-0000-0000-0000000000c1.rc); b=$(cat /tmp/race_00000000-0000-0000-0000-0000000000c2.rc)
if [ "$n" = "1" ] && [ "$a" = "0" ] && [ "$b" != "0" ] && grep -q sold_out /tmp/race_00000000-0000-0000-0000-0000000000c2.log; then
  echo "  ok - last-seat race: first booking wins, second gets sold_out"
  echo "RACE TEST PASSED"
else
  echo "FAIL: last-seat race (active bookings=$n, rc1=$a, rc2=$b)"; cat /tmp/race_*.log; exit 1
fi
