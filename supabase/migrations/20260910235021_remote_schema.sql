

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "api";


ALTER SCHEMA "api" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  delete from transactions where user_id = p_user_id;
  delete from budgets      where user_id = p_user_id;
  delete from categories   where user_id = p_user_id;
  delete from profiles     where id      = p_user_id;
end;
$$;


ALTER FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name',''),
    ''
  )
  on conflict (id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_valid_tz"("tz" "text") RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from pg_timezone_names where name = tz
  );
$$;


ALTER FUNCTION "public"."is_valid_tz"("tz" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sum_category_amount"("uid" "uuid", "cat_id" integer) RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(sum(amount), 0)
  from transactions
  where user_id = uid and category_id = cat_id;
$$;


ALTER FUNCTION "public"."sum_category_amount"("uid" "uuid", "cat_id" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sum_expense_amount"("uid" "uuid") RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(sum(amount), 0)
  from transactions
  join categories on transactions.category_id = categories.id
  where 
    categories.type = 'expense'
    and transactions.user_id = uid
$$;


ALTER FUNCTION "public"."sum_expense_amount"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sum_income_amount"("uid" "uuid") RETURNS numeric
    LANGUAGE "sql"
    AS $$
  select coalesce(sum(amount), 0)
  from transactions
  join categories on transactions.category_id = categories.id
  where 
    categories.type = 'income'
    and transactions.user_id = uid
$$;


ALTER FUNCTION "public"."sum_income_amount"("uid" "uuid") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."budgets" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category_id" integer,
    "month" integer NOT NULL,
    "year" integer NOT NULL,
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "budgets_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "budgets_month_check" CHECK ((("month" >= 1) AND ("month" <= 12)))
);


ALTER TABLE "public"."budgets" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."budgets_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."budgets_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."budgets_id_seq" OWNED BY "public"."budgets"."id";



CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" integer NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp without time zone DEFAULT "now"(),
    CONSTRAINT "categories_type_check" CHECK (("type" = ANY (ARRAY['income'::"text", 'expense'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."categories_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."categories_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."categories_id_seq" OWNED BY "public"."categories"."id";



CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "full_name" "text",
    "avatar_url" "text",
    "created_at" timestamp without time zone DEFAULT "now"(),
    "budget_reset_cycle" "text" DEFAULT 'month'::"text" NOT NULL,
    "reset_day" integer DEFAULT 1 NOT NULL,
    "timezone" "text" DEFAULT 'America/Los_Angeles'::"text" NOT NULL,
    CONSTRAINT "profiles_timezone_valid" CHECK ("public"."is_valid_tz"("timezone"))
);


ALTER TABLE "public"."profiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "id" integer NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount" numeric(10,2) NOT NULL,
    "category_id" integer,
    "note" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "merchant" "text",
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."transactions_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."transactions_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."transactions_id_seq" OWNED BY "public"."transactions"."id";



CREATE OR REPLACE VIEW "public"."v_tx_search" WITH ("security_invoker"='on') AS
 SELECT "t"."id",
    "t"."user_id",
    "t"."amount",
    "t"."category_id",
    "t"."merchant",
    "t"."note",
    "t"."created_at",
    "c"."name" AS "category_name",
    "c"."type" AS "category_type"
   FROM ("public"."transactions" "t"
     LEFT JOIN "public"."categories" "c" ON (("c"."id" = "t"."category_id")));


ALTER VIEW "public"."v_tx_search" OWNER TO "postgres";


ALTER TABLE ONLY "public"."budgets" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."budgets_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."categories" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."categories_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."transactions" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."transactions_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_category_id_month_year_key" UNIQUE ("user_id", "category_id", "month", "year");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "categories_global_unique" ON "public"."categories" USING "btree" ("name", "type") WHERE ("user_id" IS NULL);



CREATE UNIQUE INDEX "categories_personal_unique" ON "public"."categories" USING "btree" ("user_id", "name", "type") WHERE ("user_id" IS NOT NULL);



CREATE UNIQUE INDEX "categories_user_name_type_uidx" ON "public"."categories" USING "btree" ("user_id", "name", "type");



CREATE UNIQUE INDEX "categories_user_type_name_unique" ON "public"."categories" USING "btree" ("user_id", "type", "lower"("name"));



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."budgets"
    ADD CONSTRAINT "budgets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users can create their own budgets" ON "public"."budgets" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own categories" ON "public"."categories" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can create their own profile row" ON "public"."profiles" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can create their own transactions" ON "public"."transactions" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own budgets" ON "public"."budgets" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own categories" ON "public"."categories" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can delete their own profile" ON "public"."profiles" FOR DELETE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can delete their own transactions" ON "public"."transactions" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own budgets" ON "public"."budgets" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own categories" ON "public"."categories" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can update their own profile" ON "public"."profiles" FOR UPDATE USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can update their own transactions" ON "public"."transactions" FOR UPDATE USING (("auth"."uid"() = "user_id")) WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view global OR personal categories" ON "public"."categories" FOR SELECT USING ((("user_id" IS NULL) OR ("user_id" = "auth"."uid"())));



CREATE POLICY "Users can view their budgets" ON "public"."budgets" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users can view their own profile" ON "public"."profiles" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view their transactions" ON "public"."transactions" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."budgets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."profiles";



GRANT USAGE ON SCHEMA "api" TO "anon";
GRANT USAGE ON SCHEMA "api" TO "authenticated";
GRANT USAGE ON SCHEMA "api" TO "service_role";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";

























































































































































REVOKE ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_user_everything"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_valid_tz"("tz" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."is_valid_tz"("tz" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_valid_tz"("tz" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum_category_amount"("uid" "uuid", "cat_id" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sum_category_amount"("uid" "uuid", "cat_id" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum_category_amount"("uid" "uuid", "cat_id" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sum_expense_amount"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sum_expense_amount"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum_expense_amount"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum_income_amount"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."sum_income_amount"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum_income_amount"("uid" "uuid") TO "service_role";


















GRANT ALL ON TABLE "public"."budgets" TO "anon";
GRANT ALL ON TABLE "public"."budgets" TO "authenticated";
GRANT ALL ON TABLE "public"."budgets" TO "service_role";



GRANT ALL ON SEQUENCE "public"."budgets_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."budgets_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."budgets_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."categories_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."profiles" TO "anon";
GRANT ALL ON TABLE "public"."profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."profiles" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."transactions_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."v_tx_search" TO "anon";
GRANT ALL ON TABLE "public"."v_tx_search" TO "authenticated";
GRANT ALL ON TABLE "public"."v_tx_search" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";






























drop extension if exists "pg_net";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


  create policy "Authenticated Users can upload 1oj01fe_0"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((auth.uid() IS NOT NULL) AND (bucket_id = 'avatars'::text) AND (name ~~ (auth.uid() || '%'::text))));



  create policy "Authenticated Users can upload 1oj01fe_1"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((auth.uid() IS NOT NULL) AND (bucket_id = 'avatars'::text) AND (name ~~ (auth.uid() || '%'::text))));



  create policy "Authenticated Users can upload 1oj01fe_2"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((auth.uid() IS NOT NULL) AND (bucket_id = 'avatars'::text) AND (name ~~ (auth.uid() || '%'::text))));



  create policy "Authenticated Users can upload 1oj01fe_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((auth.uid() IS NOT NULL) AND (bucket_id = 'avatars'::text) AND (name ~~ (auth.uid() || '%'::text))));



