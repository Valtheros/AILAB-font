alter table "user"
  add column if not exists role text not null default 'user',
  add column if not exists banned boolean not null default false,
  add column if not exists "banReason" text,
  add column if not exists "banExpires" timestamptz;

alter table session
  add column if not exists "impersonatedBy" text;

update "user"
set role = 'user'
where role is null or trim(role) = '';

update "user"
set banned = false
where banned is null;

create index if not exists idx_projects_created_by on projects(created_by);
create index if not exists idx_datasets_created_by on datasets(created_by);
create index if not exists idx_workspace_members_user_id on workspace_members(user_id);
