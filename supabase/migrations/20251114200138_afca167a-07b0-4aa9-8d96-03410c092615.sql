-- Create profiles table
create table public.profiles (
  id uuid not null references auth.users on delete cascade,
  email text,
  nome text,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  
  primary key (id)
);

-- Enable RLS
alter table public.profiles enable row level security;

-- RLS Policies
create policy "Users can view their own profile"
  on public.profiles
  for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id);

-- Function to handle new user
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, nome)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'nome', '')
  );
  return new;
end;
$$;

-- Trigger for new users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Trigger for updated_at
create trigger update_profiles_updated_at
  before update on public.profiles
  for each row
  execute function public.update_updated_at_column();