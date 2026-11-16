-- Phase 15 part 1: service providers. Run with: npm run test:db
\set ON_ERROR_STOP on
begin;
create function pg_temp.check(ok boolean, label text) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok - %', label;
end $$;
create function pg_temp.expect_error(stmt text, code_like text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAIL: % (no error)', label;
exception when others then
  if sqlerrm like 'FAIL:%' then raise; end if;
  if sqlerrm not like code_like then raise exception 'FAIL: % (got %)', label, sqlerrm; end if;
  raise notice 'ok - %', label;
end $$;
insert into public.services (slug, name, space) values ('test-prov', 'Test providers', 'BRICKR');
update public.services set providers = '[{"name":"Ahmed Fouad","title":"Partner","photo":"/images/ahmed.jpg","brief":"Operator and investor.","linkedin":"https://www.linkedin.com/in/ahmed-fouad-azm"}]' where slug = 'test-prov';
select pg_temp.check((select providers -> 0 ->> 'brief' = 'Operator and investor.' from public.services where slug = 'test-prov'), 'services keep providers with a brief');
select pg_temp.expect_error($$update public.services set providers = jsonb_build_array(jsonb_build_object('name', 'X', 'brief', repeat('x', 401))) where slug = 'test-prov'$$, '%check%', 'briefs are at most 400 characters');
select pg_temp.expect_error($$update public.services set providers = '[{"title":"no name"}]' where slug = 'test-prov'$$, '%check%', 'providers need a name');
select pg_temp.check((select count(*) = 0 from public.services where space = 'BRICKR' and slug <> 'test-prov' and providers = '[]'::jsonb), 'existing BRICKR services have providers');
rollback;
