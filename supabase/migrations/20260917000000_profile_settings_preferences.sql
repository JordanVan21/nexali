-- Backend Part 6: real backend persistence for the Profile/Settings fields
-- that were intentionally left backend-pending during the Lovable redesign
-- (visually present, hard-disabled, captioned "Coming soon -- not saved
-- yet"). See docs/BACKEND_AUDIT_REPORT.md Backend Part 6 for the full
-- field-by-field audit that confirmed none of these columns already exist
-- under any name.
--
-- All six new columns belong to `profiles`, which is already row-owned and
-- RLS-protected (`Users can view/update their own profile`, scoped to
-- `auth.uid() = id`) -- no new RPC or policy is needed to update them
-- safely; the existing `supabase.from("profiles").update(...).eq("id",
-- userId)` path (src/lib/profile.ts / useUpdateProfile) already prevents
-- user A from updating user B's row.

-- ============================================================================
-- Profile identity/context fields -- user-authored metadata only.
-- ============================================================================

-- Free-text, user-entered contact number. Deliberately NOT validated against
-- any international phone-number format: the current frontend has no
-- specific format contract (the Profile field is a plain disabled <input
-- type="tel">), so imposing one now would be inventing a restriction the
-- product never asked for. Stored as the user's plain text input.
ALTER TABLE "public"."profiles" ADD COLUMN "phone" "text";

-- Free-text, user-entered location (e.g. "Seattle, WA"). Display/context
-- metadata only -- no geocoding, no structured address, no GPS. Stored
-- exactly as entered.
ALTER TABLE "public"."profiles" ADD COLUMN "location" "text";

-- User-authored financial-goals blurb for Aura context (NOT an Aura prompt
-- or generated output -- purely profile metadata the user writes about
-- themselves). Length-capped at 240 to match the existing Profile UI's
-- already-shipped `BIO_LIMIT = 240` character counter and `maxLength={240}`
-- textarea -- the frontend contract already implies this constraint; the
-- database now enforces it too rather than trusting the client alone.
ALTER TABLE "public"."profiles" ADD COLUMN "financial_bio" "text";
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_financial_bio_length"
  CHECK ("financial_bio" IS NULL OR "char_length"("financial_bio") <= 240);

COMMENT ON COLUMN "public"."profiles"."phone" IS 'User-entered contact phone number, stored as free text (no format validation).';
COMMENT ON COLUMN "public"."profiles"."location" IS 'User-entered display location (e.g. city, state). Plain text only -- not geocoded.';
COMMENT ON COLUMN "public"."profiles"."financial_bio" IS 'User-authored financial-goals blurb for Aura context. Max 240 chars, matching the Profile page''s existing character counter.';

-- ============================================================================
-- Settings preferences -- currency/date/number FORMAT/DISPLAY preferences
-- only. These do not represent or trigger any FX conversion, nor any
-- change to how transactions are stored -- see the currency NOT NULL
-- DEFAULT note below and docs/BACKEND_AUDIT_REPORT.md Backend Part 6 for
-- the explicit "display convention, not conversion" semantics.
-- ============================================================================

-- Nexali has always implicitly assumed USD everywhere (formatCurrency's
-- prior hardcoded default). DEFAULT 'USD' preserves that exact existing
-- behavior for every existing row with zero visible change on deploy.
-- Constrained to exactly the six currencies the real Settings UI's
-- CURRENCY_OPTIONS list offers today -- not the full ISO 4217 set -- since
-- the UI cannot select (and therefore the database should not silently
-- accept) any other code yet.
ALTER TABLE "public"."profiles" ADD COLUMN "currency" "text" DEFAULT 'USD'::"text" NOT NULL;
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_currency_valid"
  CHECK ("currency" = ANY (ARRAY['USD'::"text", 'EUR'::"text", 'GBP'::"text", 'CAD'::"text", 'AUD'::"text", 'JPY'::"text"]));

-- 'mdy' (MM/DD/YYYY) matches the exact value the real (previously disabled)
-- Settings Date-format Select already displayed as selected
-- (`<Select value="mdy" disabled>`), and is what `toLocaleDateString()`'s
-- en-US-style browser default has always effectively rendered throughout
-- the app -- so existing users see no unexpected formatting change on
-- deploy. Constrained to the three options the real
-- DATE_FORMAT_OPTIONS list offers.
ALTER TABLE "public"."profiles" ADD COLUMN "date_format" "text" DEFAULT 'mdy'::"text" NOT NULL;
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_date_format_valid"
  CHECK ("date_format" = ANY (ARRAY['mdy'::"text", 'dmy'::"text", 'ymd'::"text"]));

-- 'standard' (1,234.56) matches the exact value the real (previously
-- disabled) Settings Number-format Select already displayed as selected
-- (`<Select value="standard" disabled>`), and is what formatCurrency's
-- prior hardcoded "en-US" locale has always effectively rendered -- so
-- existing users see no unexpected formatting change on deploy.
-- Constrained to the three options the real NUMBER_FORMAT_OPTIONS list
-- offers.
ALTER TABLE "public"."profiles" ADD COLUMN "number_format" "text" DEFAULT 'standard'::"text" NOT NULL;
ALTER TABLE "public"."profiles" ADD CONSTRAINT "profiles_number_format_valid"
  CHECK ("number_format" = ANY (ARRAY['standard'::"text", 'european'::"text", 'space'::"text"]));

COMMENT ON COLUMN "public"."profiles"."currency" IS 'Display-currency convention (ISO 4217 code) for formatting monetary amounts. A FORMAT preference only -- changing it never converts, rescales, or otherwise mutates any stored transaction/budget amount.';
COMMENT ON COLUMN "public"."profiles"."date_format" IS 'Preferred calendar-date display pattern for user-facing transaction dates (mdy = MM/DD/YYYY, dmy = DD/MM/YYYY, ymd = YYYY-MM-DD). Does not affect CSV export, which stays YYYY-MM-DD for machine stability.';
COMMENT ON COLUMN "public"."profiles"."number_format" IS 'Preferred thousands/decimal separator convention for formatted monetary amounts (standard = 1,234.56, european = 1.234,56, space = 1 234.56).';
