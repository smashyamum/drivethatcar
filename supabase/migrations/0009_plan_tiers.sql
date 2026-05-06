-- Update organizations.plan to support the new tier system.
--
-- Before: ('trial', 'active', 'suspended')
-- After:  ('trial', 'free', 'starter_trial', 'starter', 'pro_trial', 'pro', 'suspended')
--
-- 'trial' is kept for the founding dealer (drivethatcar) who was hand-migrated
-- in 0008 — they get unlimited access until we explicitly migrate them onto a
-- paid plan. New signups get one of free / *_trial / starter / pro.

alter table organizations
  drop constraint if exists organizations_plan_check;

alter table organizations
  add constraint organizations_plan_check
  check (plan in (
    'trial',
    'free',
    'starter_trial',
    'starter',
    'pro_trial',
    'pro',
    'suspended'
  ));
