-- Schema
--
-- PostgreSQL database dump
--

-- Dumped from database version 17.8 (a48d9ca)
-- Dumped by pg_dump version 17.8 (a48d9ca)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: neondb_owner
--

-- *not* creating schema, since initdb creates it


ALTER SCHEMA public OWNER TO neondb_owner;

--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: neondb_owner
--

COMMENT ON SCHEMA public IS '';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.audit_logs (
    id integer NOT NULL,
    user_id integer,
    action character varying(100) NOT NULL,
    entity_type character varying(100),
    entity_id integer,
    old_values jsonb,
    new_values jsonb,
    ip_address character varying(50),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.audit_logs OWNER TO neondb_owner;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.audit_logs_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_logs_id_seq OWNER TO neondb_owner;

--
-- Name: audit_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.audit_logs_id_seq OWNED BY public.audit_logs.id;


--
-- Name: auth_accounts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.auth_accounts (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    type character varying(255) NOT NULL,
    provider character varying(255) NOT NULL,
    "providerAccountId" character varying(255) NOT NULL,
    refresh_token text,
    access_token text,
    expires_at bigint,
    id_token text,
    scope text,
    session_state text,
    token_type text,
    password text
);


ALTER TABLE public.auth_accounts OWNER TO neondb_owner;

--
-- Name: auth_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.auth_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auth_accounts_id_seq OWNER TO neondb_owner;

--
-- Name: auth_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.auth_accounts_id_seq OWNED BY public.auth_accounts.id;


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.auth_sessions (
    id integer NOT NULL,
    "userId" integer NOT NULL,
    expires timestamp with time zone NOT NULL,
    "sessionToken" character varying(255) NOT NULL
);


ALTER TABLE public.auth_sessions OWNER TO neondb_owner;

--
-- Name: auth_sessions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.auth_sessions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auth_sessions_id_seq OWNER TO neondb_owner;

--
-- Name: auth_sessions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.auth_sessions_id_seq OWNED BY public.auth_sessions.id;


--
-- Name: auth_users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.auth_users (
    id integer NOT NULL,
    name character varying(255),
    email character varying(255),
    "emailVerified" timestamp with time zone,
    image text
);


ALTER TABLE public.auth_users OWNER TO neondb_owner;

--
-- Name: auth_users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.auth_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.auth_users_id_seq OWNER TO neondb_owner;

--
-- Name: auth_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.auth_users_id_seq OWNED BY public.auth_users.id;


--
-- Name: auth_verification_token; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.auth_verification_token (
    identifier text NOT NULL,
    expires timestamp with time zone NOT NULL,
    token text NOT NULL
);


ALTER TABLE public.auth_verification_token OWNER TO neondb_owner;

--
-- Name: backfill_registry; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.backfill_registry (
    id bigint NOT NULL,
    source_event_id text NOT NULL,
    source_type text NOT NULL,
    accounting_tx_id text,
    hash text NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.backfill_registry OWNER TO neondb_owner;

--
-- Name: backfill_registry_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.backfill_registry ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.backfill_registry_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: chart_of_accounts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.chart_of_accounts (
    id integer NOT NULL,
    account_code character varying(20) NOT NULL,
    account_name character varying(255) NOT NULL,
    account_type character varying(50) NOT NULL,
    parent_account_id integer,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.chart_of_accounts OWNER TO neondb_owner;

--
-- Name: chart_of_accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.chart_of_accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.chart_of_accounts_id_seq OWNER TO neondb_owner;

--
-- Name: chart_of_accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.chart_of_accounts_id_seq OWNED BY public.chart_of_accounts.id;


--
-- Name: integration_account_bindings; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.integration_account_bindings (
    semantic_key text NOT NULL,
    account_id integer,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.integration_account_bindings OWNER TO neondb_owner;

--
-- Name: integration_feature_flags; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.integration_feature_flags (
    flag_name text NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.integration_feature_flags OWNER TO neondb_owner;

--
-- Name: invoice_generation_runs; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoice_generation_runs (
    id integer NOT NULL,
    invoice_month integer NOT NULL,
    invoice_year integer NOT NULL,
    status character varying(20) DEFAULT 'success'::character varying NOT NULL,
    inserted_count integer DEFAULT 0 NOT NULL,
    started_at timestamp without time zone,
    finished_at timestamp without time zone DEFAULT now(),
    error text
);


ALTER TABLE public.invoice_generation_runs OWNER TO neondb_owner;

--
-- Name: invoice_generation_runs_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

ALTER TABLE public.invoice_generation_runs ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME public.invoice_generation_runs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: invoices; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.invoices (
    id integer NOT NULL,
    lease_id integer,
    tenant_id integer,
    property_id integer,
    unit_id integer,
    invoice_date date NOT NULL,
    due_date date NOT NULL,
    invoice_month integer NOT NULL,
    invoice_year integer NOT NULL,
    description text NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    commission_rate numeric(5,2) DEFAULT 0,
    commission_amount numeric(15,2) DEFAULT 0,
    paid_amount numeric(15,2) DEFAULT 0,
    status character varying(20) DEFAULT 'open'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    CONSTRAINT invoices_currency_ugx_only CHECK (((currency)::text = 'UGX'::text))
);


ALTER TABLE public.invoices OWNER TO neondb_owner;

--
-- Name: COLUMN invoices.is_deleted; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.invoices.is_deleted IS 'Soft delete flag - excludes invoice from all calculations';


--
-- Name: COLUMN invoices.deleted_at; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.invoices.deleted_at IS 'Timestamp when invoice was deleted';


--
-- Name: COLUMN invoices.deleted_by; Type: COMMENT; Schema: public; Owner: neondb_owner
--

COMMENT ON COLUMN public.invoices.deleted_by IS 'Staff user who deleted the invoice';


--
-- Name: invoices_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.invoices_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.invoices_id_seq OWNER TO neondb_owner;

--
-- Name: invoices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.invoices_id_seq OWNED BY public.invoices.id;


--
-- Name: landlord_deductions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.landlord_deductions (
    id integer NOT NULL,
    landlord_id integer,
    property_id integer NOT NULL,
    deduction_date date NOT NULL,
    description text NOT NULL,
    amount numeric(15,2) NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer
);


ALTER TABLE public.landlord_deductions OWNER TO neondb_owner;

--
-- Name: landlord_deductions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.landlord_deductions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.landlord_deductions_id_seq OWNER TO neondb_owner;

--
-- Name: landlord_deductions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.landlord_deductions_id_seq OWNED BY public.landlord_deductions.id;


--
-- Name: landlord_payouts; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.landlord_payouts (
    id integer NOT NULL,
    landlord_id integer,
    property_id integer,
    payout_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    payment_method character varying(50) NOT NULL,
    reference_number character varying(100),
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer
);


ALTER TABLE public.landlord_payouts OWNER TO neondb_owner;

--
-- Name: landlord_payouts_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.landlord_payouts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.landlord_payouts_id_seq OWNER TO neondb_owner;

--
-- Name: landlord_payouts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.landlord_payouts_id_seq OWNED BY public.landlord_payouts.id;


--
-- Name: landlords; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.landlords (
    id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(20),
    email character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    title character varying(50),
    due_date date,
    status character varying(50) DEFAULT 'active'::character varying,
    start_date date,
    end_date date,
    payment_method character varying(20),
    bank_name character varying(255),
    bank_account_title character varying(255),
    bank_account_number character varying(100),
    mobile_money_name character varying(255),
    mobile_money_phone character varying(50),
    CONSTRAINT landlords_due_date_anchor_chk CHECK (((due_date IS NULL) OR (((EXTRACT(year FROM due_date))::integer = 2000) AND ((EXTRACT(month FROM due_date))::integer = 1)))),
    CONSTRAINT landlords_payment_method_chk CHECK (((payment_method IS NULL) OR ((payment_method)::text = ANY (ARRAY[('bank'::character varying)::text, ('mobile_money'::character varying)::text]))))
);


ALTER TABLE public.landlords OWNER TO neondb_owner;

--
-- Name: landlords_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.landlords_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.landlords_id_seq OWNER TO neondb_owner;

--
-- Name: landlords_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.landlords_id_seq OWNED BY public.landlords.id;


--
-- Name: leases; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.leases (
    id integer NOT NULL,
    unit_id integer,
    tenant_id integer,
    start_date date NOT NULL,
    end_date date NOT NULL,
    monthly_rent numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    deposit_amount numeric(15,2),
    deposit_paid numeric(15,2) DEFAULT 0,
    billing_day integer DEFAULT 1,
    auto_renew boolean DEFAULT false,
    status character varying(50) DEFAULT 'active'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT leases_currency_ugx_only CHECK (((currency)::text = 'UGX'::text))
);


ALTER TABLE public.leases OWNER TO neondb_owner;

--
-- Name: leases_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.leases_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leases_id_seq OWNER TO neondb_owner;

--
-- Name: leases_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.leases_id_seq OWNED BY public.leases.id;


--
-- Name: maintenance_requests; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.maintenance_requests (
    id integer NOT NULL,
    unit_id integer,
    property_id integer,
    tenant_id integer,
    title character varying(255) NOT NULL,
    description text,
    category character varying(100),
    priority character varying(50) DEFAULT 'medium'::character varying,
    status character varying(50) DEFAULT 'pending'::character varying,
    assigned_to character varying(255),
    cost numeric(15,2),
    approval_required boolean DEFAULT false,
    approved_by integer,
    approved_at timestamp without time zone,
    completed_at timestamp without time zone,
    created_by integer,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.maintenance_requests OWNER TO neondb_owner;

--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.maintenance_requests_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.maintenance_requests_id_seq OWNER TO neondb_owner;

--
-- Name: maintenance_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.maintenance_requests_id_seq OWNED BY public.maintenance_requests.id;


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.notifications (
    id integer NOT NULL,
    user_id integer NOT NULL,
    title character varying(255) NOT NULL,
    message text NOT NULL,
    type character varying(50) NOT NULL,
    is_read boolean DEFAULT false,
    reference_id integer,
    reference_type character varying(50),
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.notifications OWNER TO neondb_owner;

--
-- Name: notifications_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.notifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.notifications_id_seq OWNER TO neondb_owner;

--
-- Name: notifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.notifications_id_seq OWNED BY public.notifications.id;


--
-- Name: payment_invoice_allocations; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payment_invoice_allocations (
    id integer NOT NULL,
    payment_id integer,
    invoice_id integer,
    amount_applied numeric(15,2) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.payment_invoice_allocations OWNER TO neondb_owner;

--
-- Name: payment_invoice_allocations_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payment_invoice_allocations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payment_invoice_allocations_id_seq OWNER TO neondb_owner;

--
-- Name: payment_invoice_allocations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payment_invoice_allocations_id_seq OWNED BY public.payment_invoice_allocations.id;


--
-- Name: payments; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.payments (
    id integer NOT NULL,
    lease_id integer,
    tenant_id integer,
    property_id integer,
    payment_date date NOT NULL,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    payment_method character varying(50) NOT NULL,
    reference_number character varying(100),
    period_month integer,
    period_year integer,
    recorded_by integer,
    notes text,
    is_reversed boolean DEFAULT false,
    reversed_by integer,
    reversed_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    deposited_at timestamp without time zone,
    deposited_to_account_id integer,
    deposit_transaction_id integer,
    description text,
    CONSTRAINT payments_currency_ugx_only CHECK (((currency)::text = 'UGX'::text))
);


ALTER TABLE public.payments OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.payments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.payments_id_seq OWNER TO neondb_owner;

--
-- Name: payments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.payments_id_seq OWNED BY public.payments.id;


--
-- Name: properties; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.properties (
    id integer NOT NULL,
    property_name character varying(255) NOT NULL,
    address text NOT NULL,
    property_type character varying(100),
    total_units integer DEFAULT 0,
    management_fee_percent numeric(5,2) DEFAULT 10.00,
    notes text,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    landlord_id integer,
    management_fee_type character varying(10) DEFAULT 'percent'::character varying NOT NULL,
    management_fee_fixed_amount numeric(15,2),
    CONSTRAINT properties_management_fee_fixed_amount_chk CHECK ((((management_fee_type)::text <> 'fixed'::text) OR ((management_fee_fixed_amount IS NOT NULL) AND (management_fee_fixed_amount >= (0)::numeric)))),
    CONSTRAINT properties_management_fee_percent_chk CHECK (((management_fee_percent IS NULL) OR ((management_fee_percent >= (0)::numeric) AND (management_fee_percent <= (100)::numeric)))),
    CONSTRAINT properties_management_fee_type_chk CHECK (((management_fee_type)::text = ANY (ARRAY[('percent'::character varying)::text, ('fixed'::character varying)::text])))
);


ALTER TABLE public.properties OWNER TO neondb_owner;

--
-- Name: properties_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.properties_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.properties_id_seq OWNER TO neondb_owner;

--
-- Name: properties_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.properties_id_seq OWNED BY public.properties.id;


--
-- Name: staff_users; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.staff_users (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    full_name character varying(255) NOT NULL,
    role_id integer,
    phone character varying(20),
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    profile_picture text
);


ALTER TABLE public.staff_users OWNER TO neondb_owner;

--
-- Name: staff_users_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.staff_users_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.staff_users_id_seq OWNER TO neondb_owner;

--
-- Name: staff_users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.staff_users_id_seq OWNED BY public.staff_users.id;


--
-- Name: tenant_deductions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tenant_deductions (
    id integer NOT NULL,
    tenant_id integer,
    property_id integer,
    deduction_date date NOT NULL,
    description text NOT NULL,
    amount numeric(15,2) NOT NULL,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer
);


ALTER TABLE public.tenant_deductions OWNER TO neondb_owner;

--
-- Name: tenant_deductions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tenant_deductions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenant_deductions_id_seq OWNER TO neondb_owner;

--
-- Name: tenant_deductions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tenant_deductions_id_seq OWNED BY public.tenant_deductions.id;


--
-- Name: tenants; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.tenants (
    id integer NOT NULL,
    full_name character varying(255) NOT NULL,
    phone character varying(20) NOT NULL,
    email character varying(255),
    national_id character varying(50),
    emergency_contact character varying(255),
    emergency_phone character varying(20),
    status character varying(50) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    title character varying(50)
);


ALTER TABLE public.tenants OWNER TO neondb_owner;

--
-- Name: tenants_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.tenants_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.tenants_id_seq OWNER TO neondb_owner;

--
-- Name: tenants_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.tenants_id_seq OWNED BY public.tenants.id;


--
-- Name: transactions; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.transactions (
    id integer NOT NULL,
    transaction_date date NOT NULL,
    description text NOT NULL,
    reference_number character varying(100),
    debit_account_id integer,
    credit_account_id integer,
    amount numeric(15,2) NOT NULL,
    currency character varying(3) DEFAULT 'UGX'::character varying,
    created_by integer,
    created_at timestamp without time zone DEFAULT now(),
    expense_scope character varying(20),
    landlord_id integer,
    property_id integer,
    source_type character varying(50),
    source_id integer,
    is_deleted boolean DEFAULT false,
    deleted_at timestamp without time zone,
    deleted_by integer,
    deposited_by_transaction_id integer,
    CONSTRAINT transactions_currency_ugx_only CHECK (((currency)::text = 'UGX'::text))
);


ALTER TABLE public.transactions OWNER TO neondb_owner;

--
-- Name: transactions_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.transactions_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.transactions_id_seq OWNER TO neondb_owner;

--
-- Name: transactions_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.transactions_id_seq OWNED BY public.transactions.id;


--
-- Name: units; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.units (
    id integer NOT NULL,
    property_id integer,
    unit_number character varying(50) NOT NULL,
    bedrooms integer,
    bathrooms integer,
    square_feet numeric(10,2),
    monthly_rent_ugx numeric(15,2),
    deposit_amount numeric(15,2),
    status character varying(50) DEFAULT 'vacant'::character varying,
    photos text[],
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.units OWNER TO neondb_owner;

--
-- Name: units_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.units_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.units_id_seq OWNER TO neondb_owner;

--
-- Name: units_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.units_id_seq OWNED BY public.units.id;


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: neondb_owner
--

CREATE TABLE public.user_roles (
    id integer NOT NULL,
    role_name character varying(50) NOT NULL,
    permissions jsonb NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.user_roles OWNER TO neondb_owner;

--
-- Name: user_roles_id_seq; Type: SEQUENCE; Schema: public; Owner: neondb_owner
--

CREATE SEQUENCE public.user_roles_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.user_roles_id_seq OWNER TO neondb_owner;

--
-- Name: user_roles_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: neondb_owner
--

ALTER SEQUENCE public.user_roles_id_seq OWNED BY public.user_roles.id;


--
-- Name: audit_logs id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs ALTER COLUMN id SET DEFAULT nextval('public.audit_logs_id_seq'::regclass);


--
-- Name: auth_accounts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_accounts ALTER COLUMN id SET DEFAULT nextval('public.auth_accounts_id_seq'::regclass);


--
-- Name: auth_sessions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_sessions ALTER COLUMN id SET DEFAULT nextval('public.auth_sessions_id_seq'::regclass);


--
-- Name: auth_users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_users ALTER COLUMN id SET DEFAULT nextval('public.auth_users_id_seq'::regclass);


--
-- Name: chart_of_accounts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chart_of_accounts ALTER COLUMN id SET DEFAULT nextval('public.chart_of_accounts_id_seq'::regclass);


--
-- Name: invoices id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices ALTER COLUMN id SET DEFAULT nextval('public.invoices_id_seq'::regclass);


--
-- Name: landlord_deductions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_deductions ALTER COLUMN id SET DEFAULT nextval('public.landlord_deductions_id_seq'::regclass);


--
-- Name: landlord_payouts id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_payouts ALTER COLUMN id SET DEFAULT nextval('public.landlord_payouts_id_seq'::regclass);


--
-- Name: landlords id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlords ALTER COLUMN id SET DEFAULT nextval('public.landlords_id_seq'::regclass);


--
-- Name: leases id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leases ALTER COLUMN id SET DEFAULT nextval('public.leases_id_seq'::regclass);


--
-- Name: maintenance_requests id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests ALTER COLUMN id SET DEFAULT nextval('public.maintenance_requests_id_seq'::regclass);


--
-- Name: notifications id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications ALTER COLUMN id SET DEFAULT nextval('public.notifications_id_seq'::regclass);


--
-- Name: payment_invoice_allocations id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_invoice_allocations ALTER COLUMN id SET DEFAULT nextval('public.payment_invoice_allocations_id_seq'::regclass);


--
-- Name: payments id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments ALTER COLUMN id SET DEFAULT nextval('public.payments_id_seq'::regclass);


--
-- Name: properties id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.properties ALTER COLUMN id SET DEFAULT nextval('public.properties_id_seq'::regclass);


--
-- Name: staff_users id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users ALTER COLUMN id SET DEFAULT nextval('public.staff_users_id_seq'::regclass);


--
-- Name: tenant_deductions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_deductions ALTER COLUMN id SET DEFAULT nextval('public.tenant_deductions_id_seq'::regclass);


--
-- Name: tenants id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants ALTER COLUMN id SET DEFAULT nextval('public.tenants_id_seq'::regclass);


--
-- Name: transactions id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions ALTER COLUMN id SET DEFAULT nextval('public.transactions_id_seq'::regclass);


--
-- Name: units id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.units ALTER COLUMN id SET DEFAULT nextval('public.units_id_seq'::regclass);


--
-- Name: user_roles id; Type: DEFAULT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles ALTER COLUMN id SET DEFAULT nextval('public.user_roles_id_seq'::regclass);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: auth_accounts auth_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_accounts
    ADD CONSTRAINT auth_accounts_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (id);


--
-- Name: auth_users auth_users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_users
    ADD CONSTRAINT auth_users_pkey PRIMARY KEY (id);


--
-- Name: auth_verification_token auth_verification_token_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_verification_token
    ADD CONSTRAINT auth_verification_token_pkey PRIMARY KEY (identifier, token);


--
-- Name: backfill_registry backfill_registry_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.backfill_registry
    ADD CONSTRAINT backfill_registry_pkey PRIMARY KEY (id);


--
-- Name: chart_of_accounts chart_of_accounts_account_code_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_account_code_key UNIQUE (account_code);


--
-- Name: chart_of_accounts chart_of_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_pkey PRIMARY KEY (id);


--
-- Name: integration_account_bindings integration_account_bindings_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.integration_account_bindings
    ADD CONSTRAINT integration_account_bindings_pkey PRIMARY KEY (semantic_key);


--
-- Name: integration_feature_flags integration_feature_flags_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.integration_feature_flags
    ADD CONSTRAINT integration_feature_flags_pkey PRIMARY KEY (flag_name);


--
-- Name: invoice_generation_runs invoice_generation_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoice_generation_runs
    ADD CONSTRAINT invoice_generation_runs_pkey PRIMARY KEY (id);


--
-- Name: invoices invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);


--
-- Name: landlord_deductions landlord_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_deductions
    ADD CONSTRAINT landlord_deductions_pkey PRIMARY KEY (id);


--
-- Name: landlord_payouts landlord_payouts_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_payouts
    ADD CONSTRAINT landlord_payouts_pkey PRIMARY KEY (id);


--
-- Name: landlords landlords_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlords
    ADD CONSTRAINT landlords_pkey PRIMARY KEY (id);


--
-- Name: leases leases_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_pkey PRIMARY KEY (id);


--
-- Name: maintenance_requests maintenance_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: payment_invoice_allocations payment_invoice_allocations_payment_invoice_uniq; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_invoice_allocations
    ADD CONSTRAINT payment_invoice_allocations_payment_invoice_uniq UNIQUE (payment_id, invoice_id);


--
-- Name: payment_invoice_allocations payment_invoice_allocations_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_invoice_allocations
    ADD CONSTRAINT payment_invoice_allocations_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: properties properties_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_pkey PRIMARY KEY (id);


--
-- Name: staff_users staff_users_email_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_email_key UNIQUE (email);


--
-- Name: staff_users staff_users_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_pkey PRIMARY KEY (id);


--
-- Name: tenant_deductions tenant_deductions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_deductions
    ADD CONSTRAINT tenant_deductions_pkey PRIMARY KEY (id);


--
-- Name: tenants tenants_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenants
    ADD CONSTRAINT tenants_pkey PRIMARY KEY (id);


--
-- Name: transactions transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_pkey PRIMARY KEY (id);


--
-- Name: units units_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_pkey PRIMARY KEY (id);


--
-- Name: units units_property_id_unit_number_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_property_id_unit_number_key UNIQUE (property_id, unit_number);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_role_name_key; Type: CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_name_key UNIQUE (role_name);


--
-- Name: backfill_registry_hash_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX backfill_registry_hash_uniq ON public.backfill_registry USING btree (hash);


--
-- Name: backfill_registry_source_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX backfill_registry_source_uniq ON public.backfill_registry USING btree (source_type, source_event_id);


--
-- Name: integration_account_bindings_account_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX integration_account_bindings_account_id_idx ON public.integration_account_bindings USING btree (account_id);


--
-- Name: invoice_generation_runs_month_year_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX invoice_generation_runs_month_year_uniq ON public.invoice_generation_runs USING btree (invoice_year, invoice_month);


--
-- Name: invoices_due_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_due_date_idx ON public.invoices USING btree (due_date);


--
-- Name: invoices_is_deleted_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_is_deleted_idx ON public.invoices USING btree (is_deleted) WHERE (is_deleted = true);


--
-- Name: invoices_lease_month_year_rent_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX invoices_lease_month_year_rent_uniq ON public.invoices USING btree (lease_id, invoice_month, invoice_year) WHERE ((COALESCE(is_deleted, false) = false) AND (description ~~ 'Rent for:%'::text));


--
-- Name: invoices_month_year_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_month_year_idx ON public.invoices USING btree (invoice_year, invoice_month);


--
-- Name: invoices_property_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_property_idx ON public.invoices USING btree (property_id);


--
-- Name: invoices_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_status_idx ON public.invoices USING btree (status);


--
-- Name: invoices_tenant_invoice_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_tenant_invoice_date_idx ON public.invoices USING btree (tenant_id, invoice_date);


--
-- Name: invoices_tenant_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX invoices_tenant_status_idx ON public.invoices USING btree (tenant_id, status);


--
-- Name: landlord_deductions_landlord_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX landlord_deductions_landlord_idx ON public.landlord_deductions USING btree (landlord_id, deduction_date);


--
-- Name: landlord_deductions_property_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX landlord_deductions_property_idx ON public.landlord_deductions USING btree (property_id, deduction_date);


--
-- Name: landlord_payouts_landlord_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX landlord_payouts_landlord_date_idx ON public.landlord_payouts USING btree (landlord_id, payout_date);


--
-- Name: landlords_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX landlords_status_idx ON public.landlords USING btree (status);


--
-- Name: leases_tenant_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX leases_tenant_status_idx ON public.leases USING btree (tenant_id, status);


--
-- Name: leases_unit_status_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX leases_unit_status_idx ON public.leases USING btree (unit_id, status);


--
-- Name: notifications_created_at_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notifications_created_at_idx ON public.notifications USING btree (created_at DESC);


--
-- Name: notifications_is_read_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notifications_is_read_idx ON public.notifications USING btree (user_id, is_read);


--
-- Name: notifications_user_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX notifications_user_id_idx ON public.notifications USING btree (user_id);


--
-- Name: payments_not_reversed_payment_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX payments_not_reversed_payment_date_idx ON public.payments USING btree (payment_date) WHERE (is_reversed = false);


--
-- Name: pia_invoice_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX pia_invoice_idx ON public.payment_invoice_allocations USING btree (invoice_id);


--
-- Name: pia_payment_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX pia_payment_idx ON public.payment_invoice_allocations USING btree (payment_id);


--
-- Name: properties_landlord_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX properties_landlord_id_idx ON public.properties USING btree (landlord_id);


--
-- Name: tenant_deductions_tenant_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX tenant_deductions_tenant_date_idx ON public.tenant_deductions USING btree (tenant_id, deduction_date);


--
-- Name: transactions_credit_account_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_credit_account_id_idx ON public.transactions USING btree (credit_account_id);


--
-- Name: transactions_debit_account_id_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_debit_account_id_idx ON public.transactions USING btree (debit_account_id);


--
-- Name: transactions_deposited_by_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_deposited_by_idx ON public.transactions USING btree (deposited_by_transaction_id);


--
-- Name: transactions_is_deleted_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_is_deleted_idx ON public.transactions USING btree (is_deleted);


--
-- Name: transactions_mgmt_fee_fixed_ref_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX transactions_mgmt_fee_fixed_ref_uniq ON public.transactions USING btree (reference_number) WHERE (((source_type)::text = 'mgmt_fee_fixed'::text) AND (COALESCE(is_deleted, false) = false));


--
-- Name: transactions_mgmt_fee_summary_source_ref_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX transactions_mgmt_fee_summary_source_ref_uniq ON public.transactions USING btree (source_type, reference_number) WHERE ((is_deleted = false) AND ((source_type)::text = 'mgmt_fee_summary'::text) AND (reference_number IS NOT NULL));


--
-- Name: transactions_rent_summary_source_ref_uniq; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE UNIQUE INDEX transactions_rent_summary_source_ref_uniq ON public.transactions USING btree (source_type, reference_number) WHERE ((is_deleted = false) AND ((source_type)::text = 'rent_accrual_summary'::text) AND (reference_number IS NOT NULL));


--
-- Name: transactions_source_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_source_idx ON public.transactions USING btree (source_type, source_id);


--
-- Name: transactions_transaction_date_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_transaction_date_idx ON public.transactions USING btree (transaction_date);


--
-- Name: transactions_undeposited_1130_idx; Type: INDEX; Schema: public; Owner: neondb_owner
--

CREATE INDEX transactions_undeposited_1130_idx ON public.transactions USING btree (debit_account_id, deposited_by_transaction_id) WHERE (COALESCE(is_deleted, false) = false);


--
-- Name: audit_logs audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.staff_users(id);


--
-- Name: auth_accounts auth_accounts_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_accounts
    ADD CONSTRAINT "auth_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- Name: auth_sessions auth_sessions_userId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES public.auth_users(id) ON DELETE CASCADE;


--
-- Name: chart_of_accounts chart_of_accounts_parent_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.chart_of_accounts
    ADD CONSTRAINT chart_of_accounts_parent_account_id_fkey FOREIGN KEY (parent_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: invoices invoices_deleted_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_deleted_by_fkey FOREIGN KEY (deleted_by) REFERENCES public.staff_users(id);


--
-- Name: invoices invoices_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.leases(id);


--
-- Name: invoices invoices_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: invoices invoices_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: invoices invoices_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: landlord_deductions landlord_deductions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_deductions
    ADD CONSTRAINT landlord_deductions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: landlord_deductions landlord_deductions_landlord_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_deductions
    ADD CONSTRAINT landlord_deductions_landlord_id_fkey FOREIGN KEY (landlord_id) REFERENCES public.landlords(id);


--
-- Name: landlord_deductions landlord_deductions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_deductions
    ADD CONSTRAINT landlord_deductions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: landlord_payouts landlord_payouts_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_payouts
    ADD CONSTRAINT landlord_payouts_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: landlord_payouts landlord_payouts_landlord_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_payouts
    ADD CONSTRAINT landlord_payouts_landlord_id_fkey FOREIGN KEY (landlord_id) REFERENCES public.landlords(id) ON DELETE CASCADE;


--
-- Name: landlord_payouts landlord_payouts_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.landlord_payouts
    ADD CONSTRAINT landlord_payouts_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: leases leases_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: leases leases_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: leases leases_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.leases
    ADD CONSTRAINT leases_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: maintenance_requests maintenance_requests_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.staff_users(id);


--
-- Name: maintenance_requests maintenance_requests_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: maintenance_requests maintenance_requests_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: maintenance_requests maintenance_requests_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: maintenance_requests maintenance_requests_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.maintenance_requests
    ADD CONSTRAINT maintenance_requests_unit_id_fkey FOREIGN KEY (unit_id) REFERENCES public.units(id);


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.staff_users(id) ON DELETE CASCADE;


--
-- Name: payment_invoice_allocations payment_invoice_allocations_invoice_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_invoice_allocations
    ADD CONSTRAINT payment_invoice_allocations_invoice_id_fkey FOREIGN KEY (invoice_id) REFERENCES public.invoices(id) ON DELETE CASCADE;


--
-- Name: payment_invoice_allocations payment_invoice_allocations_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payment_invoice_allocations
    ADD CONSTRAINT payment_invoice_allocations_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;


--
-- Name: payments payments_deposit_transaction_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_deposit_transaction_fkey FOREIGN KEY (deposit_transaction_id) REFERENCES public.transactions(id);


--
-- Name: payments payments_deposited_to_account_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_deposited_to_account_fkey FOREIGN KEY (deposited_to_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: payments payments_lease_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_lease_id_fkey FOREIGN KEY (lease_id) REFERENCES public.leases(id);


--
-- Name: payments payments_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: payments payments_recorded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.staff_users(id);


--
-- Name: payments payments_reversed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_reversed_by_fkey FOREIGN KEY (reversed_by) REFERENCES public.staff_users(id);


--
-- Name: payments payments_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);


--
-- Name: properties properties_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: properties properties_landlord_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.properties
    ADD CONSTRAINT properties_landlord_id_fkey FOREIGN KEY (landlord_id) REFERENCES public.landlords(id);


--
-- Name: staff_users staff_users_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.staff_users
    ADD CONSTRAINT staff_users_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.user_roles(id);


--
-- Name: tenant_deductions tenant_deductions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_deductions
    ADD CONSTRAINT tenant_deductions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: tenant_deductions tenant_deductions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_deductions
    ADD CONSTRAINT tenant_deductions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;


--
-- Name: tenant_deductions tenant_deductions_tenant_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.tenant_deductions
    ADD CONSTRAINT tenant_deductions_tenant_id_fkey FOREIGN KEY (tenant_id) REFERENCES public.tenants(id) ON DELETE CASCADE;


--
-- Name: transactions transactions_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.staff_users(id);


--
-- Name: transactions transactions_credit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_credit_account_id_fkey FOREIGN KEY (credit_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: transactions transactions_debit_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_debit_account_id_fkey FOREIGN KEY (debit_account_id) REFERENCES public.chart_of_accounts(id);


--
-- Name: transactions transactions_deposited_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_deposited_by_fkey FOREIGN KEY (deposited_by_transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;


--
-- Name: transactions transactions_landlord_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_landlord_id_fkey FOREIGN KEY (landlord_id) REFERENCES public.landlords(id);


--
-- Name: transactions transactions_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.transactions
    ADD CONSTRAINT transactions_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id);


--
-- Name: units units_property_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: neondb_owner
--

ALTER TABLE ONLY public.units
    ADD CONSTRAINT units_property_id_fkey FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE CASCADE;


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: neondb_owner
--

REVOKE USAGE ON SCHEMA public FROM PUBLIC;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO neon_superuser WITH GRANT OPTION;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: cloud_admin
--

ALTER DEFAULT PRIVILEGES FOR ROLE cloud_admin IN SCHEMA public GRANT ALL ON TABLES TO neon_superuser WITH GRANT OPTION;


--
-- PostgreSQL database dump complete
--



-- Data
COPY "notifications" FROM stdin;
1	1	Lease Updated	Lease updated for Magufuli in Unit 1 at Tester. Updated by Mark Mugisha	lease	t	1	lease	2026-03-19 09:58:19.76279
2	1	Lease Updated	Lease updated for Magufuli in Unit 1 at Tester. Updated by Mark Mugisha	lease	t	1	lease	2026-03-19 09:59:56.039527
3	1	Lease Updated	Lease updated for Magufuli in Unit 1 at Tester. Updated by Mark Mugisha	lease	t	1	lease	2026-03-19 10:01:11.28095
4	1	Advance Payment Received	New advance payment of UGX 2,000,000 received from Magufuli at Tester. Recorded by Mark Mugisha	payment	t	4	payment	2026-03-23 16:22:43.928306
5	1	Advance Payment Received	New advance payment of UGX 245,000 received from Magufuli at Tester. Recorded by Mark Mugisha	payment	t	5	payment	2026-03-24 07:28:38.826389
6	1	Advance Payment Received	New advance payment of UGX 440,000 received from Magufuli at Tester. Recorded by Mark Mugisha	payment	t	6	payment	2026-03-24 08:01:44.220516
7	1	Advance Payment Received	New advance payment of UGX 70,000 received from Magufuli at Tester. Recorded by Mark Mugisha	payment	t	7	payment	2026-03-24 08:06:42.703083
8	1	Advance Payment Received	New advance payment of UGX 200,000 received from Rwatamagufa Kachope at Tester. Recorded by Mark Mugisha	payment	t	9	payment	2026-03-24 10:05:02.017096
9	1	Advance Payment Received	New advance payment of UGX 3,000 received from Rwatamagufa Kachope at Tester. Recorded by Mark Mugisha	payment	t	12	payment	2026-03-25 06:42:51.336831
10	1	Advance Payment Received	New advance payment of UGX 110,000 received from Rwatamagufa Kachope at Tester. Recorded by Mark Mugisha	payment	t	14	payment	2026-03-25 06:51:14.068685
11	1	New Payment Received	New payment of UGX 230,000 received from Rwatamagufa Kachope for Arrears before lease date. - Oct-Dec 25 Arrears. Recorded by Mark Mugisha	payment	t	15	payment	2026-03-25 07:04:31.342731
12	1	Advance Payment Received	New advance payment of UGX 390,000 received from Magufuli at Tester. Recorded by Mark Mugisha	payment	t	16	payment	2026-03-25 07:05:18.394526
13	1	Advance Payment Received	New advance payment of UGX 230,000 received from Basinga Josephine at Galaxy Heights. Recorded by Mark Mugisha	payment	f	17	payment	2026-03-29 09:20:32.191398
14	1	New Payment Received	New payment of UGX 250,000 received from Basinga Josephine for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	18	payment	2026-03-29 09:37:06.760659
15	1	Landlord Payout Recorded	Payout of UGX 900,000 recorded for Duncan Paddy (Galaxy Heights) via Bank Account - Operating. Recorded by Mark Mugisha	payout	f	1	landlord_payout	2026-03-29 10:16:03.769457
16	1	New Payment Received	New payment of UGX 250,000 received from Basinga Josephine for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	19	payment	2026-03-29 10:18:58.108585
17	1	New Payment Received	New payment of UGX 200,000 received from Trial Tenant for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	20	payment	2026-03-29 10:56:31.796555
18	1	New Payment Received	New payment of UGX 600,000 received from Fun Fanatic for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	21	payment	2026-03-29 11:07:58.808894
19	1	Landlord Payout Recorded	Payout of UGX 1,260,000 recorded for Traitor (Danger Zone) via Bank Account - Operating. Recorded by Mark Mugisha	payout	f	2	landlord_payout	2026-03-29 11:23:11.97131
20	1	New Payment Received	New payment of UGX 100,000 received from Fun Fanatic for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	22	payment	2026-03-29 11:24:53.334111
21	1	New Payment Received	New payment of UGX 400,000 received from Congratulations for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	23	payment	2026-03-29 14:40:58.306074
22	1	Landlord Payout Recorded	Payout of UGX 2,340,000 recorded for Blessed Blessing (Destiny) via Bank Account - Operating. Recorded by Mark Mugisha	payout	f	3	landlord_payout	2026-03-29 14:45:08.816432
23	1	New Payment Received	New payment of UGX 150,000 received from We Made it for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	24	payment	2026-03-29 15:30:33.95084
24	1	New Payment Received	New payment of UGX 700,000 received from Beloved for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	25	payment	2026-03-29 15:44:25.999988
25	1	New Payment Received	New payment of UGX 450,000 received from Beloved for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	26	payment	2026-03-29 15:58:51.595582
26	1	New Payment Received	New payment of UGX 400,000 received from Eliezer for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	27	payment	2026-03-29 16:15:20.235808
27	1	New Payment Received	New payment of UGX 200,000 received from Sweep for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	28	payment	2026-03-29 17:11:42.079767
28	1	New Payment Received	New payment of UGX 1,500,000 received from Latitude for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	29	payment	2026-03-29 17:35:26.891261
29	1	New Payment Received	New payment of UGX 600,000 received from Mark Mugisha for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	30	payment	2026-03-29 18:19:10.383949
30	1	New Payment Received	New payment of UGX 480,000 received from Supermarket for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	31	payment	2026-03-30 06:04:54.910289
31	1	New Payment Received	New payment of UGX 300,000 received from Saloon for Arrears before lease date.. Recorded by Mark Mugisha	payment	f	32	payment	2026-03-30 06:48:06.491662
32	1	Advance Payment Received	New advance payment of UGX 400,000 received from Namara at UK Mall. Recorded by Mark Mugisha	payment	f	33	payment	2026-03-30 08:51:07.520918
33	1	Advance Payment Received	New advance payment of UGX 750,000 received from Basinga Josephine at Galaxy Heights. Recorded by Mark Mugisha	payment	f	34	payment	2026-03-31 13:44:25.941208
34	1	Landlord Payout Recorded	Payout of UGX 100,000 recorded for Divine (Finance) via Bank Account - Operating. Recorded by Mark Mugisha	payout	f	4	landlord_payout	2026-04-01 11:16:12.558574
35	1	Landlord Payout Recorded	Payout of UGX 1,145,000 recorded for Blessed Blessing (Destiny) via Cash on Hand. Recorded by Mark Mugisha	payout	f	5	landlord_payout	2026-04-01 11:20:01.582124
36	1	Landlord Payout Recorded	Payout of UGX 500,000 recorded for Hajii (UK Mall) via Cash on Hand. Recorded by Mark Mugisha	payout	f	6	landlord_payout	2026-04-01 11:28:33.853429
37	1	Payment on Account Received	New payment on account of UGX 700,000 received from Sweep at Beautiful. Recorded by Mark Mugisha	payment	f	35	payment	2026-04-02 07:20:08.249893
38	1	Landlord Payout Recorded	Payout of UGX 402,000 recorded for Businessman (West Mall) via Bank Account - Operating. Recorded by Mark Mugisha	payout	f	7	landlord_payout	2026-04-02 10:22:45.020212
39	1	Landlord Payout Recorded	Payout of UGX 560,000 recorded for Divine (Finance) via Cash on Hand. Recorded by Mark Mugisha	payout	f	8	landlord_payout	2026-04-02 13:08:35.67438
40	1	Landlord Payout Recorded	Payout of UGX 1,165,000 recorded for New (Beautiful) via Cash on Hand. Recorded by Mark Mugisha	payout	f	9	landlord_payout	2026-04-02 15:56:55.160811
41	1	New Payment Received	New payment of UGX 250,000 received from Sweep for Rent for: March 2026. Recorded by Mark Mugisha	payment	f	36	payment	2026-04-06 11:47:44.62279
42	1	Payment on Account Received	New payment on account of UGX 850,000 received from Sweep at Beautiful. Recorded by Mark Mugisha	payment	f	37	payment	2026-04-06 13:53:13.240963

\.

COPY "backfill_registry" FROM stdin;
1	1	payment	93	546d8af3ffc9b7e9e883535af1a1de01e5f2748d9f1c81885232bacf132eb14c	2026-04-07 14:16:33.918498
2	2	payment	94	6ebcd27007ee5dfdac47ab07766d4d34213a4a949187211a64c2901270d62c0d	2026-04-07 14:16:34.626044
3	3	payment	95	1ffd6cb91b3ee810ac5da66edfffa776fadc4d271bed7ab52ffde033bf4aa7d1	2026-04-07 14:16:35.32968
4	4	payment	96	58ae84b3633b13c709c22d159c934f015661f32f7001209625fa79662a0c3a8d	2026-04-07 14:16:36.038043
5	5	payment	97	bd079358fdcbbd86f2952ec362dafbd31dce29e810f1decfde5653346bb81107	2026-04-07 14:16:36.739485
6	6	payment	98	95edad8718747e55db61b32d94a7a1595aa1ebeea3e3a34eed2ae0115bd71bb5	2026-04-07 14:16:37.439398
7	7	payment	99	4fdbae7d17c95fa579976400dcf869914c3b4aba85aa2f2be5b72d454a9af60c	2026-04-07 14:16:38.163788
8	8	payment	100	d48ed2e8553cc87bb0040d2d4d1d46540707fc0689e28b21c2a377f1c4b88788	2026-04-07 14:16:38.871293
9	9	payment	101	153b4093f664fd7ddac2d1ff65c9c772e7f62a4c6a2712c5bbc7f0014e898d35	2026-04-07 14:16:39.665273
10	10	payment	102	6bdb43440e796bd7033274f40f969dd6d8016c7c2cbb5bddb142db4596c7e72f	2026-04-07 14:16:40.381333
11	11	payment	103	990dae7696b4b68925963ef4707d6be30f98b3445feaac73aa4dfa7a08e6bf25	2026-04-07 14:16:41.081197
12	12	payment	104	4c19ab8be9be953cb24beef845eb93fa40b3e58930b46478906361bb4e9e16a6	2026-04-07 14:16:41.784537
13	13	payment	105	ae01287e501c6e247f171cb192c79285174ae5c95c92a09e0aa7cf1babfb11c6	2026-04-07 14:16:42.486196
14	14	payment	106	965ebfc6437a56c8e2640b634a9c87be6d093e63f528a025b1655c671181d59e	2026-04-07 14:16:43.185038
15	15	payment	7	d0dae1d23fd37987c3c6dafbdfbc788f0597a6551c9e6bba21684f775b8c6f1a	2026-04-07 14:16:43.361404
16	16	payment	107	988ad42dd1f9f670d4b882fa88014ae9fa8d2ca52e2197d8c96ba07106976232	2026-04-07 14:16:44.063639
17	18	payment	9	4817e657608d04d0273fe394e50d0398387e696e21f716fcb42de7696c1ac638	2026-04-07 14:16:44.241201
18	19	payment	12	d18c86eb0cb6afd4396d0ea5ccd54120f94b1b9bf6b9c7a6eb8a66954656ffa1	2026-04-07 14:16:44.416522
19	20	payment	13	d75575734d9e55dd508f48aaf7bc15ea42e41be19f11df4fc65b70cb51df93d0	2026-04-07 14:16:44.591483
20	21	payment	15	c63efcbfba56581da9e2381f4a001c26109227424c8c11a5aca205e86fe628fe	2026-04-07 14:16:44.765376
21	22	payment	19	7f1a40c01eccc4b85d7fd7627cbff6226ebb4f95a49edb4a4480c1e88e7b7fec	2026-04-07 14:16:44.94091
22	23	payment	43	9b0f9f8a42c25ae37e074d436a0dcbdd00c828cd07d3f0b598d2fa1ae07c9c43	2026-04-07 14:16:45.115471
23	24	payment	49	8cde470a9499eb30d6199006069325fe54290c30c6890eee89967979af34ff6b	2026-04-07 14:16:45.290148
24	25	payment	52	181b86b3636b263a8de09292b878c11520f1e583da56843b863452ad18690e0c	2026-04-07 14:16:45.464484
25	26	payment	55	875844113b029aed0d239f8235b0e91e741a61babd8be241f7e1a9643d99e36a	2026-04-07 14:16:45.639455
26	27	payment	58	d15f7ef7f8cd011863e22e0abbae3592984912321c9ee8b9412ad3bf32ecbf47	2026-04-07 14:16:45.814315
27	28	payment	61	d2946817a34fb13fda09e56eb25c44273bd6724f8c82bc2cb6b82b318f4d1951	2026-04-07 14:16:45.989945
28	29	payment	64	22f47894b7dccd26f272f1d726344c646775689842f9309c17886a1d82f2c848	2026-04-07 14:16:46.165275
29	30	payment	68	b61fdd00f2b4fb5c929b25682f26acfbac9e18f685f833add909c00550b0c9b2	2026-04-07 14:16:46.33932
30	31	payment	72	f181744b480d07f47f664fc259e5742c84b087ff2911792dc16c4e4bf238350a	2026-04-07 14:16:46.514701
31	32	payment	75	408195bf11b6b06762c69fb0d6469577dd43de6b43497c13d92a28312350cdb6	2026-04-07 14:16:46.690736
32	33	payment	108	4d163d57812fe3c2d2149604a4168b8bfb68d54ea1dc734e8e21075de106a1bb	2026-04-07 14:16:47.510674
33	34	payment	109	9368996a868933a85a90c9d1e91585774c7dbd6a2a911ecfd6610cff165fad27	2026-04-07 14:16:48.209251
34	35	payment	110	10313c673300203ace07298074d7f2e7b02bc64df97791671113a5769189af47	2026-04-07 14:16:48.913808
35	36	payment	91	4bae4976ccbb20af91daa6e7e6877a265496573033f61250698e359a0c1fb87c	2026-04-07 14:16:49.089995
36	37	payment	111	b72c175624880670872192c44198152a2db97f98976236967d32e5d15a248c40	2026-04-07 14:16:49.807891
37	5	landlord_payout	83	c81b4c4796411acbb88c86248ebe5f037c57ee1471e1b12cad3f3efa5d21fea8	2026-04-07 14:16:50.041869
38	6	landlord_payout	84	faf61923ff63219d925ef52f77073fc8ab2fb4a65f4f96651407917f10af6597	2026-04-07 14:16:50.216646
39	1	landlord_payout	11	9617d75e1b2685d35fc0fee13d0b11895d364664bee08265a83894da693b4264	2026-04-07 14:16:50.39036
40	3	landlord_payout	46	49748788d19a2513439d5ca017889290536a5c05de5e0578f288722e050eae9a	2026-04-07 14:16:50.565272
41	7	landlord_payout	86	16ab75dafe2e7ef45c5bf874e3f887e8c0db08fe0f6907f010a3d00a2721bdd4	2026-04-07 14:16:50.740671
42	9	landlord_payout	90	a397025305a0ed8ffc828eeaa60229762eb7b82c8decdc75ce3dee0417308dd7	2026-04-07 14:16:50.916033
43	4	landlord_payout	81	e3a1d5315a5d68d39cbc9d3d1589f683192a92516a2c66e42aff88de2f420e8e	2026-04-07 14:16:51.110211
44	2	landlord_deduction	14	a55054143187fdf97300717ac502abc0ff7c1020b9a9a28c1c20662e782150e3	2026-04-07 14:16:51.343252
45	3	landlord_deduction	16	d1f0e231d73c623c101096e9c1c456bcd8486deafde0970e586737f6b9992b06	2026-04-07 14:16:51.517754
46	4	landlord_deduction	20	7442fbfa1ca03de4f3098aab224d45482793db9f53f2e89d2baa85109e619fba	2026-04-07 14:16:51.69233
47	5	landlord_deduction	44	001ffab3e4d5850fa6b39bfdb779796ec8b4bba2191b32954a008030b24282dc	2026-04-07 14:16:51.866908
48	6	landlord_deduction	50	f87e1e7d97f2e9224e6fca1a2e8447b559b27f7b3774dee881a7c6a1a6dfb864	2026-04-07 14:16:52.041126
49	7	landlord_deduction	53	555a0f7dc755b37c718a36c5d80872defe5398314706a17b238522a14910af0f	2026-04-07 14:16:52.216846
50	8	landlord_deduction	56	52b2f828906642ffef2982756c0ba8acde5547ac62cdfb9f7ef401c67771e3ec	2026-04-07 14:16:52.391772
51	9	landlord_deduction	59	9120b0b6f26520883d36304aaa1425d7832687b16573ea8636ab60ed43f4ced6	2026-04-07 14:16:52.566004
52	10	landlord_deduction	62	0055f95a714043b09b862e37de62cca6eb1439f406c934c57713418e1d318821	2026-04-07 14:16:52.741105
53	11	landlord_deduction	65	bd939eb81a4c5aef5b3ca5969689ae1a4456dad61aed87a02d0b8ee54bab05e5	2026-04-07 14:16:52.915784
54	12	landlord_deduction	69	efaadfe226013fe86242bd0186a099b5413b8c754ae558c48dbef0ac655a70b8	2026-04-07 14:16:53.091093
55	13	landlord_deduction	73	ebc91f5efd33633985b876c28a5d28082dfc741e861c6de976481f657ae582fd	2026-04-07 14:16:53.266798
56	14	landlord_deduction	76	dd5aa4455bb85f12eddfd7c238a28d00750224bd5457d3f7595ffeff2c38fd41	2026-04-07 14:16:53.442329

\.

COPY "integration_feature_flags" FROM stdin;
cil_enabled	t	2026-04-07 15:09:10.706238
historical_backfill_completed	t	2026-04-07 15:15:01.283048

\.

COPY "invoice_generation_runs" FROM stdin;
1	4	2026	success	0	2026-04-01 09:17:20.462549	2026-04-01 09:17:21.640721	\N

\.

COPY "staff_users" FROM stdin;
1	mhmugisha@gmail.com	Mark Mugisha	1	+256757645933	t	\N	2026-03-17 12:14:32.86148	\N

\.

COPY "audit_logs" FROM stdin;
1	1	landlord.create	landlord	1	\N	{"id": 1, "email": null, "phone": "0567", "title": null, "status": "active", "due_day": 12, "due_date": "2000-01-12T00:00:00.000Z", "end_date": null, "bank_name": null, "full_name": "Mark", "created_at": "2026-03-19T09:55:37.578Z", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "Mark", "bank_account_title": null, "mobile_money_phone": "0772308559", "bank_account_number": null}	\N	2026-03-19 09:55:37.649703
2	1	properties.create	properties	1	\N	{"id": 1, "notes": null, "address": "Testing", "created_at": "2026-03-19T09:56:20.239Z", "created_by": 1, "landlord_id": 1, "total_units": 0, "property_name": "Tester", "property_type": "Commercial", "management_fee_type": "fixed", "management_fee_percent": null, "management_fee_fixed_amount": "300000.00"}	\N	2026-03-19 09:56:20.310835
3	1	units.create	units	1	\N	{"id": 1, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-19T09:56:38.084Z", "property_id": 1, "square_feet": null, "unit_number": "1", "deposit_amount": null, "monthly_rent_ugx": "1500000.00", "monthly_rent_usd": null}	\N	2026-03-19 09:56:38.222721
4	1	tenant.create	tenant	1	\N	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-19 09:57:45.866458
5	1	lease.create	lease	1	\N	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-02-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	\N	2026-03-19 09:57:45.935001
6	1	tenant.update	tenant	1	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-19 09:58:17.773003
7	1	lease.update	lease	1	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-02-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	\N	2026-03-19 09:58:19.561228
8	1	tenant.update	tenant	1	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-19 09:59:52.234277
9	1	lease.update	lease	1	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-01-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	\N	2026-03-19 09:59:55.838645
10	1	tenant.update	tenant	1	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	{"id": 1, "email": null, "phone": "078000000", "title": null, "status": "active", "full_name": "Magufuli", "created_at": "2026-03-19T09:57:42.928Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-19 10:01:07.372912
11	1	lease.update	lease	1	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-01-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	{"id": 1, "status": "active", "unit_id": 1, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 1, "auto_renew": false, "created_at": "2026-03-19T09:57:42.998Z", "created_by": 1, "start_date": "2026-04-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1500000.00", "deposit_amount": null}	\N	2026-03-19 10:01:11.080429
12	1	accounting.accounts.seed	chart_of_accounts	\N	\N	{"insertedCodes": ["1110", "1120", "1130", "1210", "1300", "1400", "2100", "2150", "2200", "2300", "2400", "3100", "3200", "4100", "4200", "4300", "4400", "5110", "5120", "5130", "5140", "5150", "5210", "5220", "5230", "5240"], "insertedCount": 26}	\N	2026-03-23 16:21:34.862802
13	1	cil.accounting.upsert	transaction	1	\N	{"id": 1, "cil": {"source": {"sourceEntity": {"id": 4, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "2000000.00", "currency": "UGX", "source_id": 4, "created_at": "2026-03-23T16:22:43.680Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": null, "transaction_date": "2026-03-23T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-23 16:22:43.745571
14	1	payment.create	payment	4	\N	{"id": 4, "notes": null, "amount": "2000000.00", "currency": "UGX", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-23T16:22:41.580Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-23T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": null, "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-23 16:22:43.804915
15	1	invoice.delete	invoice	2	{"id": 2, "amount": "1500000.00", "status": "open", "unit_id": 1, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-19T09:57:43.205Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 2, "amount": "1500000.00", "status": "open", "unit_id": 1, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-19T09:57:43.205Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-23 18:31:32.026438
16	1	accounting.arrears.create	invoice	7	\N	{"id": 7, "amount": "400000.00", "status": "open", "unit_id": 1, "currency": "UGX", "due_date": "2025-12-31T00:00:00.000Z", "lease_id": null, "tenant_id": 1, "created_at": "2026-03-24T07:25:14.249Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date. - Arrears before Jan 26", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2025-12-31T00:00:00.000Z", "invoice_year": 2025, "invoice_month": 12, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-24 07:25:17.350289
17	1	cil.accounting.upsert	transaction	2	\N	{"id": 2, "cil": {"source": {"sourceEntity": {"id": 5, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "245000.00", "currency": "UGX", "source_id": 5, "created_at": "2026-03-24T07:28:38.552Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "234", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-24 07:28:38.622245
18	1	payment.create	payment	5	\N	{"id": 5, "notes": null, "amount": "245000.00", "currency": "UGX", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-24T07:28:36.099Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-24T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "234", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-24 07:28:38.690461
19	1	accounting.arrears.create	invoice	8	\N	{"id": 8, "amount": "340000.00", "status": "open", "unit_id": 1, "currency": "UGX", "due_date": "2025-12-10T00:00:00.000Z", "lease_id": null, "tenant_id": 1, "created_at": "2026-03-24T07:59:21.198Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date. - Arrears in December 25", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2025-12-10T00:00:00.000Z", "invoice_year": 2025, "invoice_month": 12, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-24 07:59:24.291076
20	1	cil.accounting.upsert	transaction	2	{"id": 2, "amount": "245000.00", "currency": "UGX", "source_id": 5, "created_at": "2026-03-24T07:28:38.552Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "234", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	{"id": 2, "cil": {"source": {"sourceEntity": {"id": 6, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "update", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "440000.00", "currency": "UGX", "source_id": 6, "created_at": "2026-03-24T07:28:38.552Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "234", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-24 08:01:44.013401
21	1	payment.create	payment	6	\N	{"id": 6, "notes": null, "amount": "440000.00", "currency": "UGX", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-24T08:01:41.465Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-24T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "234", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-24 08:01:44.081875
22	1	accounting.arrears.create	invoice	9	\N	{"id": 9, "amount": "99000.00", "status": "open", "unit_id": 1, "currency": "UGX", "due_date": "2026-02-10T00:00:00.000Z", "lease_id": null, "tenant_id": 1, "created_at": "2026-03-24T08:05:56.674Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date. - Feb arrears", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2026-02-10T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-24 08:05:59.725885
23	1	cil.accounting.upsert	transaction	3	\N	{"id": 3, "cil": {"source": {"sourceEntity": {"id": 7, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "70000.00", "currency": "UGX", "source_id": 7, "created_at": "2026-03-24T08:06:42.424Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "123", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-24 08:06:42.49459
24	1	payment.create	payment	7	\N	{"id": 7, "notes": null, "amount": "70000.00", "currency": "UGX", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-24T08:06:41.944Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-24T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "123", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-24 08:06:42.564257
25	1	units.create	units	2	\N	{"id": 2, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-24T09:54:15.140Z", "property_id": 1, "square_feet": null, "unit_number": "2", "deposit_amount": null, "monthly_rent_ugx": "400000.00", "monthly_rent_usd": null}	\N	2026-03-24 09:54:15.285083
26	1	tenant.create	tenant	2	\N	{"id": 2, "email": null, "phone": "076000000", "title": null, "status": "active", "full_name": "Rwatamagufa Kachope", "created_at": "2026-03-24T09:55:14.048Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-24 09:55:17.51288
27	1	lease.create	lease	2	\N	{"id": 2, "status": "active", "unit_id": 2, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 2, "auto_renew": false, "created_at": "2026-03-24T09:55:14.119Z", "created_by": 1, "start_date": "2026-01-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "400000.00", "deposit_amount": null}	\N	2026-03-24 09:55:17.580994
28	1	accounting.arrears.create	invoice	13	\N	{"id": 13, "amount": "1000000.00", "status": "open", "unit_id": 2, "currency": "UGX", "due_date": "2025-12-10T00:00:00.000Z", "lease_id": null, "tenant_id": 2, "created_at": "2026-03-24T09:57:25.052Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date. - Oct-Dec 25 Arrears", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2025-12-10T00:00:00.000Z", "invoice_year": 2025, "invoice_month": 12, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-24 09:57:28.107015
29	1	cil.accounting.upsert	transaction	4	\N	{"id": 4, "cil": {"source": {"sourceEntity": {"id": 9, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "200000.00", "currency": "UGX", "source_id": 9, "created_at": "2026-03-24T10:05:01.737Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Rwatamagufa Kachope - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "678", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-24 10:05:01.809929
30	1	payment.create	payment	9	\N	{"id": 9, "notes": null, "amount": "200000.00", "currency": "UGX", "lease_id": 2, "tenant_id": 2, "created_at": "2026-03-24T10:04:59.194Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-24T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "678", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-24 10:05:01.878582
31	1	cil.accounting.upsert	transaction	5	\N	{"id": 5, "cil": {"source": {"sourceEntity": {"id": 12, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "3000.00", "currency": "UGX", "source_id": 12, "created_at": "2026-03-25T06:42:51.090Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Rwatamagufa Kachope - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "987", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-25 06:42:51.153931
32	1	payment.create	payment	12	\N	{"id": 12, "notes": "Partial", "amount": "3000.00", "currency": "UGX", "lease_id": 2, "tenant_id": 2, "created_at": "2026-03-25T06:42:48.790Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-25T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "987", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-25 06:42:51.216855
33	1	cil.accounting.upsert	transaction	6	\N	{"id": 6, "cil": {"source": {"sourceEntity": {"id": 14, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "110000.00", "currency": "UGX", "source_id": 14, "created_at": "2026-03-25T06:51:13.829Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Rwatamagufa Kachope - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "900", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-25 06:51:13.891481
34	1	payment.create	payment	14	\N	{"id": 14, "notes": null, "amount": "110000.00", "currency": "UGX", "lease_id": 2, "tenant_id": 2, "created_at": "2026-03-25T06:51:11.678Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-25T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "900", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-25 06:51:13.949909
35	1	cil.accounting.upsert	transaction	7	\N	{"id": 7, "cil": {"source": {"sourceEntity": {"id": 15, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "230000.00", "currency": "UGX", "source_id": 15, "created_at": "2026-03-25T07:04:31.037Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Rwatamagufa Kachope - Arrears before lease date. - Oct-Dec 25 Arrears", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "549", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-25 07:04:31.101772
36	1	payment.create	payment	15	\N	{"id": 15, "notes": null, "amount": "230000.00", "currency": "UGX", "lease_id": null, "tenant_id": 2, "created_at": "2026-03-25T07:04:28.644Z", "description": "Arrears before lease date. - Oct-Dec 25 Arrears", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-25T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "549", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-25 07:04:31.165325
37	1	invoice.payment.apply	invoice	13	{"id": 13, "amount": "1000000.00", "status": "open", "unit_id": 2, "currency": "UGX", "due_date": "2025-12-10T00:00:00.000Z", "lease_id": null, "tenant_id": 2, "created_at": "2026-03-24T09:57:25.052Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date. - Oct-Dec 25 Arrears", "landlord_id": 1, "outstanding": "230000.00", "paid_amount": "770000.00", "property_id": 1, "tenant_name": "Rwatamagufa Kachope", "invoice_date": "2025-12-10T00:00:00.000Z", "invoice_year": 2025, "invoice_month": 12, "property_name": "Tester", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 13, "amount": "1000000.00", "status": "paid", "unit_id": 2, "currency": "UGX", "due_date": "2025-12-10T00:00:00.000Z", "lease_id": null, "tenant_id": 2, "created_at": "2026-03-24T09:57:25.052Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date. - Oct-Dec 25 Arrears", "paid_amount": "1000000.00", "property_id": 1, "invoice_date": "2025-12-10T00:00:00.000Z", "invoice_year": 2025, "invoice_month": 12, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-25 07:04:31.22409
38	1	cil.accounting.upsert	transaction	8	\N	{"id": 8, "cil": {"source": {"sourceEntity": {"id": 16, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "390000.00", "currency": "UGX", "source_id": 16, "created_at": "2026-03-25T07:05:18.152Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "901", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-25 07:05:18.212948
39	1	payment.create	payment	16	\N	{"id": 16, "notes": null, "amount": "390000.00", "currency": "UGX", "lease_id": 1, "tenant_id": 1, "created_at": "2026-03-25T07:05:17.743Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 1, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-25T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "901", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-25 07:05:18.272379
40	1	landlord.create	landlord	2	\N	{"id": 2, "email": null, "phone": "0784999999", "title": null, "status": "active", "due_day": 10, "due_date": "2000-01-10T00:00:00.000Z", "end_date": null, "bank_name": "Centenary", "full_name": "Duncan Paddy", "created_at": "2026-03-29T08:42:56.819Z", "start_date": "2025-12-01T00:00:00.000Z", "payment_method": "bank", "mobile_money_name": null, "bank_account_title": "Duncan Paddy", "mobile_money_phone": null, "bank_account_number": "32021367888"}	\N	2026-03-29 08:42:56.882882
41	1	properties.create	properties	2	\N	{"id": 2, "notes": null, "address": "Kyanja", "created_at": "2026-03-29T08:44:37.827Z", "created_by": 1, "landlord_id": 2, "total_units": 0, "property_name": "Galaxy Heights", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 08:44:37.892299
42	1	units.create	units	3	\N	{"id": 3, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T09:14:03.733Z", "property_id": 2, "square_feet": null, "unit_number": "1", "deposit_amount": null, "monthly_rent_ugx": "750000.00", "monthly_rent_usd": null}	\N	2026-03-29 09:14:03.857179
43	1	tenant.create	tenant	3	\N	{"id": 3, "email": null, "phone": "0789000000", "title": null, "status": "active", "full_name": "Basinga Josephine", "created_at": "2026-03-29T09:15:04.979Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 09:15:07.909279
44	1	lease.create	lease	3	\N	{"id": 3, "status": "active", "unit_id": 3, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 3, "auto_renew": false, "created_at": "2026-03-29T09:15:05.040Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "750000.00", "deposit_amount": null}	\N	2026-03-29 09:15:07.969075
116	1	lease.create	lease	6	\N	{"id": 6, "status": "active", "unit_id": 6, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 6, "auto_renew": false, "created_at": "2026-03-29T14:36:16.058Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1000000.00", "deposit_amount": null}	\N	2026-03-29 14:36:19.141697
45	1	accounting.arrears.create	invoice	621	\N	{"id": 621, "amount": "500000.00", "status": "open", "unit_id": 3, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T09:18:02.492Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 2, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 09:18:05.106603
46	1	cil.accounting.upsert	transaction	3	{"id": 3, "amount": "70000.00", "currency": "UGX", "source_id": 7, "created_at": "2026-03-24T08:06:42.424Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": 1, "property_id": 1, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "123", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	{"id": 3, "cil": {"source": {"sourceEntity": {"id": 17, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "update", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "230000.00", "currency": "UGX", "source_id": 17, "created_at": "2026-03-24T08:06:42.424Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Basinga Josephine - Galaxy Heights", "landlord_id": 2, "property_id": 2, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "123", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-29 09:20:32.014496
47	1	payment.create	payment	17	\N	{"id": 17, "notes": null, "amount": "230000.00", "currency": "UGX", "lease_id": 3, "tenant_id": 3, "created_at": "2026-03-29T09:20:29.816Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "123", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 09:20:32.072881
48	1	payment.delete	payment	17	{"id": 17, "notes": null, "amount": "230000.00", "currency": "UGX", "lease_id": 3, "tenant_id": 3, "created_at": "2026-03-29T09:20:29.816Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "123", "deposit_transaction_id": null, "deposited_to_account_id": null}	{"id": 17, "notes": null, "amount": "230000.00", "currency": "UGX", "lease_id": 3, "tenant_id": 3, "created_at": "2026-03-29T09:20:29.816Z", "description": "Payment on Account", "is_reversed": true, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "123", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 09:31:13.117852
49	1	cil.accounting.upsert	transaction	9	\N	{"id": 9, "cil": {"source": {"sourceEntity": {"id": 18, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "250000.00", "currency": "UGX", "source_id": 18, "created_at": "2026-03-29T09:37:06.465Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Basinga Josephine - Arrears before lease date.", "landlord_id": 2, "property_id": 2, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "342", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 09:37:06.526631
50	1	payment.create	payment	18	\N	{"id": 18, "notes": null, "amount": "250000.00", "currency": "UGX", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T09:37:04.159Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "342", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 09:37:06.585529
51	1	invoice.payment.apply	invoice	621	{"id": 621, "amount": "500000.00", "status": "open", "unit_id": 3, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T09:18:02.492Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 2, "outstanding": "500000.00", "paid_amount": "0.00", "property_id": 2, "tenant_name": "Basinga Josephine", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Galaxy Heights", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 621, "amount": "500000.00", "status": "open", "unit_id": 3, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T09:18:02.492Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "250000.00", "property_id": 2, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 09:37:06.644004
52	1	accounting.deposit.create	transaction	10	\N	{"id": 10, "amount": 2000000, "currency": "UGX", "source_id": null, "created_at": "2026-03-29T09:42:18.644764", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Magufuli - Tester", "landlord_id": null, "property_id": null, "source_type": "deposit", "expense_scope": null, "transaction_ids": [1], "debit_account_id": 2, "reference_number": null, "transaction_date": "2026-03-29", "credit_account_id": 3, "deposited_by_transaction_id": null}	\N	2026-03-29 09:42:18.711972
53	1	cil.accounting.upsert	transaction	11	\N	{"id": 11, "cil": {"source": {"sourceEntity": {"id": 1, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 2}}, "debitIntent": "landlord_liability", "creditIntent": "bank_account"}, "amount": "900000.00", "currency": "UGX", "source_id": 1, "created_at": "2026-03-29T10:16:03.468Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Bank Account - Operating", "landlord_id": 2, "property_id": 2, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 2, "deposited_by_transaction_id": null}	\N	2026-03-29 10:16:03.530554
54	1	landlord.payout.create	landlord_payout	1	\N	{"id": 1, "notes": null, "amount": "900000.00", "created_at": "2026-03-29T10:16:02.998Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 2, "payout_date": "2026-03-29T00:00:00.000Z", "property_id": 2, "payment_method": "Bank Account - Operating", "reference_number": null}	\N	2026-03-29 10:16:03.593118
55	1	cil.accounting.upsert	transaction	12	\N	{"id": 12, "cil": {"source": {"sourceEntity": {"id": 19, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "250000.00", "currency": "UGX", "source_id": 19, "created_at": "2026-03-29T10:18:57.814Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Basinga Josephine - Arrears before lease date.", "landlord_id": 2, "property_id": 2, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "546", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 10:18:57.87456
56	1	payment.create	payment	19	\N	{"id": 19, "notes": null, "amount": "250000.00", "currency": "UGX", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T10:18:55.499Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "546", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 10:18:57.933164
57	1	invoice.payment.apply	invoice	621	{"id": 621, "amount": "500000.00", "status": "open", "unit_id": 3, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T09:18:02.492Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 2, "outstanding": "250000.00", "paid_amount": "250000.00", "property_id": 2, "tenant_name": "Basinga Josephine", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Galaxy Heights", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 621, "amount": "500000.00", "status": "paid", "unit_id": 3, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 3, "created_at": "2026-03-29T09:18:02.492Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "500000.00", "property_id": 2, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 10:18:57.991793
58	1	units.create	units	4	\N	{"id": 4, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T10:53:34.634Z", "property_id": 2, "square_feet": null, "unit_number": "2", "deposit_amount": null, "monthly_rent_ugx": "400000.00", "monthly_rent_usd": null}	\N	2026-03-29 10:53:34.756337
59	1	tenant.create	tenant	4	\N	{"id": 4, "email": null, "phone": "0776000000", "title": null, "status": "active", "full_name": "Trial Tenant", "created_at": "2026-03-29T10:54:31.574Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 10:54:34.492269
60	1	lease.create	lease	4	\N	{"id": 4, "status": "active", "unit_id": 4, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 4, "auto_renew": false, "created_at": "2026-03-29T10:54:31.634Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "400000.00", "deposit_amount": null}	\N	2026-03-29 10:54:34.550701
61	1	accounting.arrears.create	invoice	660	\N	{"id": 660, "amount": "300000.00", "status": "open", "unit_id": 4, "currency": "UGX", "due_date": "2026-02-26T00:00:00.000Z", "lease_id": null, "tenant_id": 4, "created_at": "2026-03-29T10:55:39.043Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 2, "invoice_date": "2026-02-26T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 10:55:41.690204
62	1	cil.accounting.upsert	transaction	13	\N	{"id": 13, "cil": {"source": {"sourceEntity": {"id": 20, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "200000.00", "currency": "UGX", "source_id": 20, "created_at": "2026-03-29T10:56:30.976Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Trial Tenant - Arrears before lease date.", "landlord_id": 2, "property_id": 2, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "908", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 10:56:31.038176
64	1	payment.create	payment	20	\N	{"id": 20, "notes": null, "amount": "200000.00", "currency": "UGX", "lease_id": null, "tenant_id": 4, "created_at": "2026-03-29T10:56:30.372Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "908", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 10:56:31.620789
63	1	cil.accounting.upsert	transaction	14	\N	{"id": 14, "cil": {"source": {"sourceEntity": {"id": 2, "type": "landlord_deduction", "invoiceId": 660}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "20000.00", "currency": "UGX", "source_id": 2, "created_at": "2026-03-29T10:56:31.501Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 2, "property_id": 2, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 10:56:31.561151
65	1	invoice.payment.apply	invoice	660	{"id": 660, "amount": "300000.00", "status": "open", "unit_id": 4, "currency": "UGX", "due_date": "2026-02-26T00:00:00.000Z", "lease_id": null, "tenant_id": 4, "created_at": "2026-03-29T10:55:39.043Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 2, "outstanding": "300000.00", "paid_amount": "0.00", "property_id": 2, "tenant_name": "Trial Tenant", "invoice_date": "2026-02-26T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Galaxy Heights", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 660, "amount": "300000.00", "status": "open", "unit_id": 4, "currency": "UGX", "due_date": "2026-02-26T00:00:00.000Z", "lease_id": null, "tenant_id": 4, "created_at": "2026-03-29T10:55:39.043Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "200000.00", "property_id": 2, "invoice_date": "2026-02-26T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 10:56:31.679543
66	1	landlord.create	landlord	3	\N	{"id": 3, "email": null, "phone": "0772000000", "title": null, "status": "active", "due_day": 15, "due_date": "2000-01-15T00:00:00.000Z", "end_date": null, "bank_name": "Cente", "full_name": "Traitor", "created_at": "2026-03-29T11:02:20.342Z", "start_date": "2026-03-01T00:00:00.000Z", "payment_method": "bank", "mobile_money_name": null, "bank_account_title": "Traitor", "mobile_money_phone": null, "bank_account_number": "03246759"}	\N	2026-03-29 11:02:20.424896
67	1	properties.create	properties	3	\N	{"id": 3, "notes": null, "address": "Stress street", "created_at": "2026-03-29T11:03:16.061Z", "created_by": 1, "landlord_id": 3, "total_units": 0, "property_name": "Danger Zone", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 11:03:16.125286
68	1	units.create	units	5	\N	{"id": 5, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T11:03:43.605Z", "property_id": 3, "square_feet": null, "unit_number": "T-2", "deposit_amount": null, "monthly_rent_ugx": "800000.00", "monthly_rent_usd": null}	\N	2026-03-29 11:03:43.728238
69	1	tenant.create	tenant	5	\N	{"id": 5, "email": null, "phone": "078900000", "title": null, "status": "active", "full_name": "Fun Fanatic", "created_at": "2026-03-29T11:05:12.487Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 11:05:15.417191
70	1	lease.create	lease	5	\N	{"id": 5, "status": "active", "unit_id": 5, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 5, "auto_renew": false, "created_at": "2026-03-29T11:05:12.549Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "800000.00", "deposit_amount": null}	\N	2026-03-29 11:05:15.475602
71	1	accounting.arrears.create	invoice	667	\N	{"id": 667, "amount": "700000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-20T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:06:41.123Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 3, "invoice_date": "2026-02-20T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 11:06:43.791046
72	1	cil.accounting.upsert	transaction	15	\N	{"id": 15, "cil": {"source": {"sourceEntity": {"id": 21, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "600000.00", "currency": "UGX", "source_id": 21, "created_at": "2026-03-29T11:07:57.953Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Fun Fanatic - Arrears before lease date.", "landlord_id": 3, "property_id": 3, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "897", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 11:07:58.016595
73	1	cil.accounting.upsert	transaction	16	\N	{"id": 16, "cil": {"source": {"sourceEntity": {"id": 3, "type": "landlord_deduction", "invoiceId": 667}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "60000.00", "currency": "UGX", "source_id": 3, "created_at": "2026-03-29T11:07:58.490Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 3, "property_id": 3, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 11:07:58.553712
74	1	payment.create	payment	21	\N	{"id": 21, "notes": null, "amount": "600000.00", "currency": "UGX", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:07:55.623Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 3, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "897", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 11:07:58.631053
75	1	invoice.payment.apply	invoice	667	{"id": 667, "amount": "700000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-20T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:06:41.123Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 3, "outstanding": "700000.00", "paid_amount": "0.00", "property_id": 3, "tenant_name": "Fun Fanatic", "invoice_date": "2026-02-20T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Danger Zone", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 667, "amount": "700000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-20T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:06:41.123Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "600000.00", "property_id": 3, "invoice_date": "2026-02-20T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 11:07:58.689793
76	1	accounting.deposit.create	transaction	17	\N	{"id": 17, "amount": 1373000, "currency": "UGX", "source_id": null, "created_at": "2026-03-29T11:22:19.797361", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Multiple tenants - Multiple periods", "landlord_id": null, "property_id": null, "source_type": "deposit", "expense_scope": null, "transaction_ids": [2, 4, 5, 6, 7, 8], "debit_account_id": 2, "reference_number": null, "transaction_date": "2026-03-29", "credit_account_id": 3, "deposited_by_transaction_id": null}	\N	2026-03-29 11:22:19.869577
77	1	cil.accounting.upsert	transaction	18	\N	{"id": 18, "cil": {"source": {"sourceEntity": {"id": 2, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 2}}, "debitIntent": "landlord_liability", "creditIntent": "bank_account"}, "amount": "1260000.00", "currency": "UGX", "source_id": 2, "created_at": "2026-03-29T11:23:11.677Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Bank Account - Operating", "landlord_id": 3, "property_id": 3, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 2, "deposited_by_transaction_id": null}	\N	2026-03-29 11:23:11.737146
78	1	landlord.payout.create	landlord_payout	2	\N	{"id": 2, "notes": null, "amount": "1260000.00", "created_at": "2026-03-29T11:23:11.214Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 3, "payout_date": "2026-03-29T00:00:00.000Z", "property_id": 3, "payment_method": "Bank Account - Operating", "reference_number": null}	\N	2026-03-29 11:23:11.795527
79	1	cil.accounting.upsert	transaction	19	\N	{"id": 19, "cil": {"source": {"sourceEntity": {"id": 22, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": 22, "created_at": "2026-03-29T11:24:52.508Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Fun Fanatic - Arrears before lease date.", "landlord_id": 3, "property_id": 3, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "453", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 11:24:52.568524
80	1	cil.accounting.upsert	transaction	20	\N	{"id": 20, "cil": {"source": {"sourceEntity": {"id": 4, "type": "landlord_deduction", "invoiceId": 667}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "10000.00", "currency": "UGX", "source_id": 4, "created_at": "2026-03-29T11:24:53.039Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 3, "property_id": 3, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 11:24:53.099888
81	1	payment.create	payment	22	\N	{"id": 22, "notes": null, "amount": "100000.00", "currency": "UGX", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:24:50.199Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 3, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "453", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 11:24:53.159064
82	1	invoice.payment.apply	invoice	667	{"id": 667, "amount": "700000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-20T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:06:41.123Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 3, "outstanding": "100000.00", "paid_amount": "600000.00", "property_id": 3, "tenant_name": "Fun Fanatic", "invoice_date": "2026-02-20T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Danger Zone", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 667, "amount": "700000.00", "status": "paid", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-20T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:06:41.123Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "700000.00", "property_id": 3, "invoice_date": "2026-02-20T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 11:24:53.21761
113	1	units.create	units	6	\N	{"id": 6, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T14:35:21.379Z", "property_id": 4, "square_feet": null, "unit_number": "1", "deposit_amount": null, "monthly_rent_ugx": "1000000.00", "monthly_rent_usd": null}	\N	2026-03-29 14:35:21.51394
83	1	accounting.arrears.create	invoice	692	\N	{"id": 692, "amount": "200000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T11:55:13.982Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 3, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 11:55:16.708165
84	1	cil.accounting.upsert	transaction	21	\N	{"id": 21, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "200000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T12:20:44.718Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Rent accrual reversal", "landlord_id": null, "property_id": null, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 12:20:44.78458
85	1	cil.accounting.upsert	transaction	22	\N	{"id": 22, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "20000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T12:20:45.133Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal", "landlord_id": null, "property_id": null, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 12:20:45.193355
86	1	accounting.arrears.create	invoice	711	\N	{"id": 711, "amount": "100000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-22T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T12:32:41.576Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 3, "invoice_date": "2026-02-22T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 12:32:44.406613
87	1	cil.accounting.upsert	transaction	23	\N	{"id": 23, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T12:34:35.430Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Invoice reversal - Rent accrual reversal", "landlord_id": null, "property_id": null, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 12:34:35.494261
88	1	cil.accounting.upsert	transaction	24	\N	{"id": 24, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "10000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T12:34:35.846Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Invoice reversal - Management fee reversal", "landlord_id": null, "property_id": null, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 12:34:35.906598
89	1	cil.accounting.upsert	transaction	25	\N	{"id": 25, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T12:40:28.349Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Rent accrual reversal", "landlord_id": null, "property_id": null, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 12:40:28.410791
90	1	cil.accounting.upsert	transaction	26	\N	{"id": 26, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "10000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T12:40:28.762Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal", "landlord_id": null, "property_id": null, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 12:40:28.824579
91	1	accounting.arrears.create	invoice	730	\N	{"id": 730, "amount": "15000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-02T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T13:11:52.544Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 3, "invoice_date": "2026-02-02T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 13:11:55.274196
92	1	cil.accounting.upsert	transaction	27	\N	{"id": 27, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "15000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T13:12:26.949Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Rent accrual reversal", "landlord_id": null, "property_id": 3, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 13:12:27.014999
93	1	cil.accounting.upsert	transaction	28	\N	{"id": 28, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 5, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "1500.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T13:12:27.413Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal", "landlord_id": null, "property_id": 3, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 13:12:27.475748
94	1	accounting.arrears.create	invoice	731	\N	{"id": 731, "amount": "111000.00", "status": "open", "unit_id": 4, "currency": "UGX", "due_date": "2026-02-11T00:00:00.000Z", "lease_id": null, "tenant_id": 4, "created_at": "2026-03-29T13:23:50.027Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 2, "invoice_date": "2026-02-11T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 13:23:52.832686
95	1	cil.accounting.upsert	transaction	29	\N	{"id": 29, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 4, "property_id": 2}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "111000.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T13:24:20.612Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Rent accrual reversal", "landlord_id": null, "property_id": 2, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 13:24:20.674524
96	1	cil.accounting.upsert	transaction	30	\N	{"id": 30, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 4, "property_id": 2}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "11100.00", "currency": "UGX", "source_id": null, "created_at": "2026-03-29T13:24:21.022Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal", "landlord_id": null, "property_id": 2, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 13:24:21.08233
97	1	cil.accounting.upsert	transaction	31	\N	{"id": 31, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 4, "invoice_id": 731, "property_id": 2}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "111000.00", "currency": "UGX", "source_id": 731, "created_at": "2026-03-29T13:43:33.377Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 2, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 13:43:33.443305
114	1	units.create	units	7	\N	{"id": 7, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T14:35:34.852Z", "property_id": 4, "square_feet": null, "unit_number": "2", "deposit_amount": null, "monthly_rent_ugx": "1200000.00", "monthly_rent_usd": null}	\N	2026-03-29 14:35:34.973609
117	1	tenant.create	tenant	7	\N	{"id": 7, "email": null, "phone": "08971", "title": null, "status": "active", "full_name": "We Made it", "created_at": "2026-03-29T14:36:47.046Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 14:36:48.256959
118	1	lease.create	lease	7	\N	{"id": 7, "status": "active", "unit_id": 7, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 7, "auto_renew": false, "created_at": "2026-03-29T14:36:47.107Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1200000.00", "deposit_amount": null}	\N	2026-03-29 14:36:48.317229
98	1	cil.accounting.upsert	transaction	32	\N	{"id": 32, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 4, "invoice_id": 731, "property_id": 2}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "11100.00", "currency": "UGX", "source_id": 731, "created_at": "2026-03-29T13:43:33.805Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 2, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 13:43:33.86541
99	1	accounting.arrears.create	invoice	744	\N	{"id": 744, "amount": "92000.00", "status": "open", "unit_id": 5, "currency": "UGX", "due_date": "2026-02-01T00:00:00.000Z", "lease_id": null, "tenant_id": 5, "created_at": "2026-03-29T13:45:17.181Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 3, "invoice_date": "2026-02-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 13:45:19.82837
100	1	cil.accounting.upsert	transaction	33	\N	{"id": 33, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 5, "invoice_id": 744, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "92000.00", "currency": "UGX", "source_id": 744, "created_at": "2026-03-29T13:51:08.137Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 3, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 13:51:08.203196
101	1	cil.accounting.upsert	transaction	34	\N	{"id": 34, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 5, "invoice_id": 744, "property_id": 3}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "9200.00", "currency": "UGX", "source_id": 744, "created_at": "2026-03-29T13:51:08.559Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 3, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 13:51:08.620511
102	1	accounting.arrears.create	invoice	757	\N	{"id": 757, "amount": "234000.00", "status": "open", "unit_id": 2, "currency": "UGX", "due_date": "2025-12-31T00:00:00.000Z", "lease_id": null, "tenant_id": 2, "created_at": "2026-03-29T14:06:49.443Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 1, "invoice_date": "2025-12-31T00:00:00.000Z", "invoice_year": 2025, "invoice_month": 12, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 14:06:52.096666
103	1	cil.accounting.upsert	transaction	35	\N	{"id": 35, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "33999.99", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:07:30.203Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 14:07:30.26715
104	1	cil.accounting.upsert	transaction	36	\N	{"id": 36, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "300000.00", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:07:30.618Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 14:07:30.682895
115	1	tenant.create	tenant	6	\N	{"id": 6, "email": null, "phone": "07768", "title": null, "status": "active", "full_name": "Congratulations", "created_at": "2026-03-29T14:36:15.996Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 14:36:19.082423
156	1	lease.create	lease	9	\N	{"id": 9, "status": "active", "unit_id": 9, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 9, "auto_renew": false, "created_at": "2026-03-29T16:08:59.836Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1000000.00", "deposit_amount": null}	\N	2026-03-29 16:09:02.89196
105	1	cil.accounting.upsert	transaction	37	\N	{"id": 37, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "134000.00", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:18:09.599Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 14:18:09.6694
106	1	cil.accounting.upsert	transaction	38	\N	{"id": 38, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "171794.87", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:18:10.046Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 14:18:10.111149
107	1	cil.accounting.upsert	transaction	39	\N	{"id": 39, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "134000.00", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:23:31.250Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 14:23:31.326796
108	1	cil.accounting.upsert	transaction	40	\N	{"id": 40, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "171794.87", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:23:31.683Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 14:23:31.744038
109	1	cil.accounting.upsert	transaction	41	\N	{"id": 41, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "50000.00", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:26:17.376Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 14:26:17.437268
110	1	cil.accounting.upsert	transaction	42	\N	{"id": 42, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 2, "invoice_id": 757, "property_id": 1}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "150000.00", "currency": "UGX", "source_id": 757, "created_at": "2026-03-29T14:26:17.788Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 1, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 14:26:17.849685
111	1	landlord.create	landlord	4	\N	{"id": 4, "email": null, "phone": "087400000", "title": null, "status": "active", "due_day": 20, "due_date": "2000-01-20T00:00:00.000Z", "end_date": "2027-02-28T00:00:00.000Z", "bank_name": null, "full_name": "Blessed Blessing", "created_at": "2026-03-29T14:34:06.653Z", "start_date": "2025-12-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "Blessing", "bank_account_title": null, "mobile_money_phone": "0757000111", "bank_account_number": null}	\N	2026-03-29 14:34:06.739335
112	1	properties.create	properties	4	\N	{"id": 4, "notes": null, "address": "Heavenly", "created_at": "2026-03-29T14:35:09.910Z", "created_by": 1, "landlord_id": 4, "total_units": 0, "property_name": "Destiny", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 14:35:09.979748
119	1	accounting.arrears.create	invoice	774	\N	{"id": 774, "amount": "600000.00", "status": "open", "unit_id": 6, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 6, "created_at": "2026-03-29T14:39:15.312Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 4, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 14:39:18.030808
120	1	cil.accounting.upsert	transaction	43	\N	{"id": 43, "cil": {"source": {"sourceEntity": {"id": 23, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "400000.00", "currency": "UGX", "source_id": 23, "created_at": "2026-03-29T14:40:57.468Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Congratulations - Arrears before lease date.", "landlord_id": 4, "property_id": 4, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "34", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 14:40:57.533047
121	1	cil.accounting.upsert	transaction	44	\N	{"id": 44, "cil": {"source": {"sourceEntity": {"id": 5, "type": "landlord_deduction", "invoiceId": 774}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "40000.00", "currency": "UGX", "source_id": 5, "created_at": "2026-03-29T14:40:58.004Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 4, "property_id": 4, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 14:40:58.06574
122	1	payment.create	payment	23	\N	{"id": 23, "notes": null, "amount": "400000.00", "currency": "UGX", "lease_id": null, "tenant_id": 6, "created_at": "2026-03-29T14:40:55.125Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 4, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "34", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 14:40:58.128081
123	1	invoice.payment.apply	invoice	774	{"id": 774, "amount": "600000.00", "status": "open", "unit_id": 6, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 6, "created_at": "2026-03-29T14:39:15.312Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 4, "outstanding": "600000.00", "paid_amount": "0.00", "property_id": 4, "tenant_name": "Congratulations", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Destiny", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 774, "amount": "600000.00", "status": "open", "unit_id": 6, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 6, "created_at": "2026-03-29T14:39:15.312Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "400000.00", "property_id": 4, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 14:40:58.187406
127	1	cil.accounting.upsert	transaction	47	\N	{"id": 47, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 6, "invoice_id": 774, "property_id": 4}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_ACCRUAL"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "200000.00", "currency": "UGX", "source_id": 774, "created_at": "2026-03-29T14:46:33.338Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 4, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 14:46:33.397946
128	1	cil.accounting.upsert	transaction	48	\N	{"id": 48, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "tenant_id": 6, "invoice_id": 774, "property_id": 4}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_income", "creditIntent": "landlord_liability"}, "amount": "20000.00", "currency": "UGX", "source_id": 774, "created_at": "2026-03-29T14:46:33.755Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 4, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 14:46:33.815302
124	1	accounting.deposit.create	transaction	45	\N	{"id": 45, "amount": 2030000, "currency": "UGX", "source_id": null, "created_at": "2026-03-29T14:44:12.386335", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Multiple tenants - Multiple periods", "landlord_id": null, "property_id": null, "source_type": "deposit", "expense_scope": null, "transaction_ids": [3, 9, 12, 13, 15, 19, 43], "debit_account_id": 2, "reference_number": null, "transaction_date": "2026-03-29", "credit_account_id": 3, "deposited_by_transaction_id": null}	\N	2026-03-29 14:44:12.454603
125	1	cil.accounting.upsert	transaction	46	\N	{"id": 46, "cil": {"source": {"sourceEntity": {"id": 3, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 2}}, "debitIntent": "landlord_liability", "creditIntent": "bank_account"}, "amount": "2340000.00", "currency": "UGX", "source_id": 3, "created_at": "2026-03-29T14:45:08.474Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Bank Account - Operating", "landlord_id": 4, "property_id": 4, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 2, "deposited_by_transaction_id": null}	\N	2026-03-29 14:45:08.534067
126	1	landlord.payout.create	landlord_payout	3	\N	{"id": 3, "notes": null, "amount": "2340000.00", "created_at": "2026-03-29T14:45:08.008Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 4, "payout_date": "2026-03-29T00:00:00.000Z", "property_id": 4, "payment_method": "Bank Account - Operating", "reference_number": null}	\N	2026-03-29 14:45:08.636873
129	1	accounting.arrears.create	invoice	807	\N	{"id": 807, "amount": "750000.00", "status": "open", "unit_id": 7, "currency": "UGX", "due_date": "2026-02-25T00:00:00.000Z", "lease_id": null, "tenant_id": 7, "created_at": "2026-03-29T15:28:32.165Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 4, "invoice_date": "2026-02-25T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 15:28:34.857715
130	1	cil.accounting.upsert	transaction	49	\N	{"id": 49, "cil": {"source": {"sourceEntity": {"id": 24, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "150000.00", "currency": "UGX", "source_id": 24, "created_at": "2026-03-29T15:30:33.127Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - We Made it - Arrears before lease date.", "landlord_id": 4, "property_id": 4, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "456", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 15:30:33.191958
131	1	cil.accounting.upsert	transaction	50	\N	{"id": 50, "cil": {"source": {"sourceEntity": {"id": 6, "type": "landlord_deduction", "invoiceId": 807}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "15000.00", "currency": "UGX", "source_id": 6, "created_at": "2026-03-29T15:30:33.657Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 4, "property_id": 4, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 15:30:33.716531
132	1	payment.create	payment	24	\N	{"id": 24, "notes": null, "amount": "150000.00", "currency": "UGX", "lease_id": null, "tenant_id": 7, "created_at": "2026-03-29T15:30:30.828Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 4, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "456", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 15:30:33.775526
133	1	invoice.payment.apply	invoice	807	{"id": 807, "amount": "750000.00", "status": "open", "unit_id": 7, "currency": "UGX", "due_date": "2026-02-25T00:00:00.000Z", "lease_id": null, "tenant_id": 7, "created_at": "2026-03-29T15:28:32.165Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 4, "outstanding": "750000.00", "paid_amount": "0.00", "property_id": 4, "tenant_name": "We Made it", "invoice_date": "2026-02-25T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Destiny", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 807, "amount": "750000.00", "status": "open", "unit_id": 7, "currency": "UGX", "due_date": "2026-02-25T00:00:00.000Z", "lease_id": null, "tenant_id": 7, "created_at": "2026-03-29T15:28:32.165Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "150000.00", "property_id": 4, "invoice_date": "2026-02-25T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 15:30:33.833981
137	1	units.create	units	8	\N	{"id": 8, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T15:36:31.592Z", "property_id": 6, "square_feet": null, "unit_number": "1", "deposit_amount": null, "monthly_rent_ugx": "2000000.00", "monthly_rent_usd": null}	\N	2026-03-29 15:36:31.714562
154	1	units.create	units	9	\N	{"id": 9, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T16:08:08.144Z", "property_id": 7, "square_feet": null, "unit_number": "A", "deposit_amount": null, "monthly_rent_ugx": "1000000.00", "monthly_rent_usd": null}	\N	2026-03-29 16:08:08.266618
134	1	cil.accounting.upsert	transaction	51	\N	{"id": 51, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 7, "invoice_id": 807, "property_id": 4}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "600000.00", "currency": "UGX", "source_id": 807, "created_at": "2026-03-29T15:32:44.771Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 4, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 15:32:44.831925
135	1	landlord.create	landlord	5	\N	{"id": 5, "email": null, "phone": "078900", "title": null, "status": "active", "due_day": 15, "due_date": "2000-01-15T00:00:00.000Z", "end_date": null, "bank_name": null, "full_name": "Reverse Tester", "created_at": "2026-03-29T15:35:15.724Z", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "Tester", "bank_account_title": null, "mobile_money_phone": "07896990", "bank_account_number": null}	\N	2026-03-29 15:35:15.786497
136	1	properties.create	properties	6	\N	{"id": 6, "notes": null, "address": "Bwaise", "created_at": "2026-03-29T15:36:10.054Z", "created_by": 1, "landlord_id": 5, "total_units": 0, "property_name": "Tested&Tried", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 15:36:10.116648
138	1	tenant.create	tenant	8	\N	{"id": 8, "email": null, "phone": "0788000", "title": null, "status": "active", "full_name": "Beloved", "created_at": "2026-03-29T15:37:09.378Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 15:37:12.490267
139	1	lease.create	lease	8	\N	{"id": 8, "status": "active", "unit_id": 8, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 8, "auto_renew": false, "created_at": "2026-03-29T15:37:09.441Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "2000000.00", "deposit_amount": null}	\N	2026-03-29 15:37:12.54982
140	1	accounting.arrears.create	invoice	818	\N	{"id": 818, "amount": "1000000.00", "status": "open", "unit_id": 8, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:37:55.809Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 6, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 15:37:56.76275
141	1	cil.accounting.upsert	transaction	52	\N	{"id": 52, "cil": {"source": {"sourceEntity": {"id": 25, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "700000.00", "currency": "UGX", "source_id": 25, "created_at": "2026-03-29T15:44:25.183Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Beloved - Arrears before lease date.", "landlord_id": 5, "property_id": 6, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "870", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 15:44:25.243097
142	1	cil.accounting.upsert	transaction	53	\N	{"id": 53, "cil": {"source": {"sourceEntity": {"id": 7, "type": "landlord_deduction", "invoiceId": 818}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "70000.00", "currency": "UGX", "source_id": 7, "created_at": "2026-03-29T15:44:25.706Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 5, "property_id": 6, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 15:44:25.765582
143	1	payment.create	payment	25	\N	{"id": 25, "notes": null, "amount": "700000.00", "currency": "UGX", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:44:22.839Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 6, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "870", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 15:44:25.824284
144	1	invoice.payment.apply	invoice	818	{"id": 818, "amount": "1000000.00", "status": "open", "unit_id": 8, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:37:55.809Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 5, "outstanding": "1000000.00", "paid_amount": "0.00", "property_id": 6, "tenant_name": "Beloved", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Tested&Tried", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 818, "amount": "1000000.00", "status": "open", "unit_id": 8, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:37:55.809Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "700000.00", "property_id": 6, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 15:44:25.882178
155	1	tenant.create	tenant	9	\N	{"id": 9, "email": null, "phone": "07800", "title": null, "status": "active", "full_name": "Eliezer", "created_at": "2026-03-29T16:08:59.773Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 16:09:02.829899
145	1	cil.accounting.upsert	transaction	54	\N	{"id": 54, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 8, "invoice_id": 818, "property_id": 6}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "300000.00", "currency": "UGX", "source_id": 818, "created_at": "2026-03-29T15:45:44.088Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 6, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 15:45:44.147286
146	1	accounting.arrears.create	invoice	828	\N	{"id": 828, "amount": "900000.00", "status": "open", "unit_id": 8, "currency": "UGX", "due_date": "2026-02-27T00:00:00.000Z", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:58:01.132Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 6, "invoice_date": "2026-02-27T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 15:58:03.854649
147	1	cil.accounting.upsert	transaction	55	\N	{"id": 55, "cil": {"source": {"sourceEntity": {"id": 26, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "450000.00", "currency": "UGX", "source_id": 26, "created_at": "2026-03-29T15:58:50.723Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Beloved - Arrears before lease date.", "landlord_id": 5, "property_id": 6, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "345", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 15:58:50.78741
148	1	cil.accounting.upsert	transaction	56	\N	{"id": 56, "cil": {"source": {"sourceEntity": {"id": 8, "type": "landlord_deduction", "invoiceId": 828}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "45000.00", "currency": "UGX", "source_id": 8, "created_at": "2026-03-29T15:58:51.260Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 5, "property_id": 6, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 15:58:51.319587
149	1	payment.create	payment	26	\N	{"id": 26, "notes": null, "amount": "450000.00", "currency": "UGX", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:58:50.111Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 6, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "345", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 15:58:51.419532
150	1	invoice.payment.apply	invoice	828	{"id": 828, "amount": "900000.00", "status": "open", "unit_id": 8, "currency": "UGX", "due_date": "2026-02-27T00:00:00.000Z", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:58:01.132Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 5, "outstanding": "900000.00", "paid_amount": "0.00", "property_id": 6, "tenant_name": "Beloved", "invoice_date": "2026-02-27T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Tested&Tried", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 828, "amount": "900000.00", "status": "open", "unit_id": 8, "currency": "UGX", "due_date": "2026-02-27T00:00:00.000Z", "lease_id": null, "tenant_id": 8, "created_at": "2026-03-29T15:58:01.132Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "450000.00", "property_id": 6, "invoice_date": "2026-02-27T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 15:58:51.478191
151	1	cil.accounting.upsert	transaction	57	\N	{"id": 57, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 8, "invoice_id": 828, "property_id": 6}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "450000.00", "currency": "UGX", "source_id": 828, "created_at": "2026-03-29T16:04:27.567Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 6, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 16:04:27.633898
152	1	landlord.create	landlord	6	\N	{"id": 6, "email": null, "phone": "0766000", "title": null, "status": "active", "due_day": 21, "due_date": "2000-01-21T00:00:00.000Z", "end_date": null, "bank_name": "Cente", "full_name": "Divine", "created_at": "2026-03-29T16:06:30.375Z", "start_date": "2026-03-01T00:00:00.000Z", "payment_method": "bank", "mobile_money_name": null, "bank_account_title": "Divine", "mobile_money_phone": null, "bank_account_number": "089765"}	\N	2026-03-29 16:06:30.439934
153	1	properties.create	properties	7	\N	{"id": 7, "notes": null, "address": "Area", "created_at": "2026-03-29T16:07:52.220Z", "created_by": 1, "landlord_id": 6, "total_units": 0, "property_name": "Finance", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 16:07:52.283052
157	1	accounting.arrears.create	invoice	849	\N	{"id": 849, "amount": "500000.00", "status": "open", "unit_id": 9, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 9, "created_at": "2026-03-29T16:12:49.155Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 7, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 16:12:51.808063
158	1	cil.accounting.upsert	transaction	58	\N	{"id": 58, "cil": {"source": {"sourceEntity": {"id": 27, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "400000.00", "currency": "UGX", "source_id": 27, "created_at": "2026-03-29T16:15:19.243Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Eliezer - Arrears before lease date.", "landlord_id": 6, "property_id": 7, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "432", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 16:15:19.305258
159	1	cil.accounting.upsert	transaction	59	\N	{"id": 59, "cil": {"source": {"sourceEntity": {"id": 9, "type": "landlord_deduction", "invoiceId": 849}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "40000.00", "currency": "UGX", "source_id": 9, "created_at": "2026-03-29T16:15:19.911Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 6, "property_id": 7, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 16:15:19.979707
160	1	payment.create	payment	27	\N	{"id": 27, "notes": null, "amount": "400000.00", "currency": "UGX", "lease_id": null, "tenant_id": 9, "created_at": "2026-03-29T16:15:16.868Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 7, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "432", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 16:15:20.042546
161	1	invoice.payment.apply	invoice	849	{"id": 849, "amount": "500000.00", "status": "open", "unit_id": 9, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 9, "created_at": "2026-03-29T16:12:49.155Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 6, "outstanding": "500000.00", "paid_amount": "0.00", "property_id": 7, "tenant_name": "Eliezer", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Finance", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 849, "amount": "500000.00", "status": "open", "unit_id": 9, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 9, "created_at": "2026-03-29T16:12:49.155Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "400000.00", "property_id": 7, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 16:15:20.105067
162	1	cil.accounting.upsert	transaction	60	\N	{"id": 60, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 9, "invoice_id": 849, "property_id": 7}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": 849, "created_at": "2026-03-29T16:18:00.275Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 7, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 16:18:00.33456
163	1	landlord.create	landlord	7	\N	{"id": 7, "email": null, "phone": "098", "title": null, "status": "active", "due_day": null, "due_date": null, "end_date": null, "bank_name": null, "full_name": "New", "created_at": "2026-03-29T17:02:38.946Z", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "new", "bank_account_title": null, "mobile_money_phone": "0978", "bank_account_number": null}	\N	2026-03-29 17:02:39.011238
164	1	landlord.update	landlord	7	{"id": 7, "email": null, "phone": "098", "title": null, "status": "active", "due_date": null, "end_date": null, "bank_name": null, "full_name": "New", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "new", "bank_account_title": null, "mobile_money_phone": "0978", "bank_account_number": null}	{"id": 7, "email": null, "phone": "098", "title": null, "status": "active", "due_day": 16, "due_date": "2000-01-16T00:00:00.000Z", "end_date": null, "bank_name": null, "full_name": "New", "created_at": "2026-03-29T17:02:38.946Z", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "new", "bank_account_title": null, "mobile_money_phone": "0978", "bank_account_number": null}	\N	2026-03-29 17:02:52.782993
165	1	properties.create	properties	8	\N	{"id": 8, "notes": null, "address": "Gate", "created_at": "2026-03-29T17:03:36.494Z", "created_by": 1, "landlord_id": 7, "total_units": 0, "property_name": "Beautiful", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 17:03:36.557969
166	1	units.create	units	10	\N	{"id": 10, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T17:03:50.386Z", "property_id": 8, "square_feet": null, "unit_number": "A", "deposit_amount": null, "monthly_rent_ugx": "700000.00", "monthly_rent_usd": null}	\N	2026-03-29 17:03:50.510501
167	1	tenant.create	tenant	10	\N	{"id": 10, "email": null, "phone": "0987", "title": null, "status": "active", "full_name": "Sweep", "created_at": "2026-03-29T17:04:29.701Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 17:04:32.802843
168	1	lease.create	lease	10	\N	{"id": 10, "status": "active", "unit_id": 10, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 10, "auto_renew": false, "created_at": "2026-03-29T17:04:29.774Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "700000.00", "deposit_amount": null}	\N	2026-03-29 17:04:32.861604
169	1	accounting.arrears.create	invoice	882	\N	{"id": 882, "amount": "200000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-29T00:00:00.000Z", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:06:46.028Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-03-29T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 17:06:46.960096
170	1	invoice.delete	invoice	882	{"id": 882, "amount": "200000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-29T00:00:00.000Z", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:06:46.028Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-03-29T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 882, "amount": "200000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-29T00:00:00.000Z", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:06:46.028Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-03-29T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 17:09:21.066939
171	1	accounting.arrears.create	invoice	883	\N	{"id": 883, "amount": "500000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:10:21.644Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 17:10:24.303219
172	1	cil.accounting.upsert	transaction	61	\N	{"id": 61, "cil": {"source": {"sourceEntity": {"id": 28, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "200000.00", "currency": "UGX", "source_id": 28, "created_at": "2026-03-29T17:11:41.255Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Sweep - Arrears before lease date.", "landlord_id": 7, "property_id": 8, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 17:11:41.320351
173	1	cil.accounting.upsert	transaction	62	\N	{"id": 62, "cil": {"source": {"sourceEntity": {"id": 10, "type": "landlord_deduction", "invoiceId": 883}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "20000.00", "currency": "UGX", "source_id": 10, "created_at": "2026-03-29T17:11:41.785Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 7, "property_id": 8, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 17:11:41.844197
174	1	payment.create	payment	28	\N	{"id": 28, "notes": null, "amount": "200000.00", "currency": "UGX", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:11:39.013Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 8, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": null, "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 17:11:41.903446
175	1	invoice.payment.apply	invoice	883	{"id": 883, "amount": "500000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:10:21.644Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 7, "outstanding": "500000.00", "paid_amount": "0.00", "property_id": 8, "tenant_name": "Sweep", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "Beautiful", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 883, "amount": "500000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 10, "created_at": "2026-03-29T17:10:21.644Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "200000.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 17:11:41.961825
176	1	cil.accounting.upsert	transaction	63	\N	{"id": 63, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 10, "invoice_id": 883, "property_id": 8}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "300000.00", "currency": "UGX", "source_id": 883, "created_at": "2026-03-29T17:15:45.620Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 8, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 17:15:45.681464
177	1	landlord.create	landlord	8	\N	{"id": 8, "email": null, "phone": "0899", "title": null, "status": "active", "due_day": 22, "due_date": "2000-01-22T00:00:00.000Z", "end_date": null, "bank_name": null, "full_name": "Hajii", "created_at": "2026-03-29T17:30:32.775Z", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "Hajji", "bank_account_title": null, "mobile_money_phone": "0789", "bank_account_number": null}	\N	2026-03-29 17:30:32.853274
178	1	properties.create	properties	9	\N	{"id": 9, "notes": null, "address": "Kyanja", "created_at": "2026-03-29T17:31:07.436Z", "created_by": 1, "landlord_id": 8, "total_units": 0, "property_name": "US Mall", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 17:31:07.502416
179	1	units.create	units	11	\N	{"id": 11, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T17:31:43.943Z", "property_id": 9, "square_feet": null, "unit_number": "1", "deposit_amount": null, "monthly_rent_ugx": "3000000.00", "monthly_rent_usd": null}	\N	2026-03-29 17:31:44.076179
180	1	tenant.create	tenant	11	\N	{"id": 11, "email": null, "phone": "0897", "title": null, "status": "active", "full_name": "Latitude", "created_at": "2026-03-29T17:32:32.670Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 17:32:35.762108
181	1	lease.create	lease	11	\N	{"id": 11, "status": "active", "unit_id": 11, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 11, "auto_renew": false, "created_at": "2026-03-29T17:32:32.732Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "3000000.00", "deposit_amount": null}	\N	2026-03-29 17:32:35.822378
182	1	accounting.arrears.create	invoice	896	\N	{"id": 896, "amount": "2000000.00", "status": "open", "unit_id": 11, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 11, "created_at": "2026-03-29T17:33:35.025Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 9, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 17:33:37.717934
183	1	cil.accounting.upsert	transaction	64	\N	{"id": 64, "cil": {"source": {"sourceEntity": {"id": 29, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "1500000.00", "currency": "UGX", "source_id": 29, "created_at": "2026-03-29T17:35:26.038Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Latitude - Arrears before lease date.", "landlord_id": 8, "property_id": 9, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "234", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 17:35:26.103344
184	1	cil.accounting.upsert	transaction	65	\N	{"id": 65, "cil": {"source": {"sourceEntity": {"id": 11, "type": "landlord_deduction", "invoiceId": 896}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "150000.00", "currency": "UGX", "source_id": 11, "created_at": "2026-03-29T17:35:26.592Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 8, "property_id": 9, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 17:35:26.653103
185	1	payment.create	payment	29	\N	{"id": 29, "notes": null, "amount": "1500000.00", "currency": "UGX", "lease_id": null, "tenant_id": 11, "created_at": "2026-03-29T17:35:23.696Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 9, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "234", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 17:35:26.712481
186	1	invoice.payment.apply	invoice	896	{"id": 896, "amount": "2000000.00", "status": "open", "unit_id": 11, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 11, "created_at": "2026-03-29T17:33:35.025Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 8, "outstanding": "2000000.00", "paid_amount": "0.00", "property_id": 9, "tenant_name": "Latitude", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "US Mall", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 896, "amount": "2000000.00", "status": "open", "unit_id": 11, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 11, "created_at": "2026-03-29T17:33:35.025Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "1500000.00", "property_id": 9, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 17:35:26.771626
187	1	cil.accounting.upsert	transaction	66	\N	{"id": 66, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 11, "invoice_id": 896, "property_id": 9}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "500000.00", "currency": "UGX", "source_id": 896, "created_at": "2026-03-29T17:40:39.940Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 9, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 17:40:40.007067
188	1	cil.accounting.upsert	transaction	67	\N	{"id": 67, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "invoice_id": 896, "property_id": 9}, "sourceModule": "accounting", "businessEvent": "MANAGEMENT_FEE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_revenue", "creditIntent": "landlord_liability"}, "amount": "50000.00", "currency": "UGX", "source_id": 896, "created_at": "2026-03-29T17:40:40.379Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 9, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 17:40:40.438801
189	1	landlord.create	landlord	9	\N	{"id": 9, "email": null, "phone": "078990", "title": null, "status": "active", "due_day": null, "due_date": null, "end_date": null, "bank_name": null, "full_name": "Umar", "created_at": "2026-03-29T18:14:28.084Z", "start_date": "2026-01-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "umar", "bank_account_title": null, "mobile_money_phone": "4567", "bank_account_number": null}	\N	2026-03-29 18:14:28.158737
190	1	properties.create	properties	10	\N	{"id": 10, "notes": null, "address": "Kensington", "created_at": "2026-03-29T18:15:41.408Z", "created_by": 1, "landlord_id": 9, "total_units": 0, "property_name": "USMall2", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-29 18:15:41.471207
191	1	units.create	units	12	\N	{"id": 12, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-29T18:16:00.723Z", "property_id": 10, "square_feet": null, "unit_number": "L214", "deposit_amount": null, "monthly_rent_ugx": "1400000.00", "monthly_rent_usd": null}	\N	2026-03-29 18:16:00.852456
192	1	tenant.create	tenant	12	\N	{"id": 12, "email": null, "phone": "0772308559", "title": null, "status": "active", "full_name": "Mark Mugisha", "created_at": "2026-03-29T18:16:53.461Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-29 18:16:56.594442
193	1	lease.create	lease	12	\N	{"id": 12, "status": "active", "unit_id": 12, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 12, "auto_renew": false, "created_at": "2026-03-29T18:16:53.523Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1400000.00", "deposit_amount": null}	\N	2026-03-29 18:16:56.654876
194	1	accounting.arrears.create	invoice	922	\N	{"id": 922, "amount": "1000000.00", "status": "open", "unit_id": 12, "currency": "UGX", "due_date": "2026-03-29T00:00:00.000Z", "lease_id": null, "tenant_id": 12, "created_at": "2026-03-29T18:17:48.960Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 10, "invoice_date": "2026-03-29T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 18:17:49.901415
195	1	cil.accounting.upsert	transaction	68	\N	{"id": 68, "cil": {"source": {"sourceEntity": {"id": 30, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "600000.00", "currency": "UGX", "source_id": 30, "created_at": "2026-03-29T18:19:09.531Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Mark Mugisha - Arrears before lease date.", "landlord_id": 9, "property_id": 10, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "231", "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 18:19:09.596609
196	1	cil.accounting.upsert	transaction	69	\N	{"id": 69, "cil": {"source": {"sourceEntity": {"id": 12, "type": "landlord_deduction", "invoiceId": 922}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "60000.00", "currency": "UGX", "source_id": 12, "created_at": "2026-03-29T18:19:10.079Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - March 2026", "landlord_id": 9, "property_id": 10, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-29 18:19:10.139924
197	1	payment.create	payment	30	\N	{"id": 30, "notes": null, "amount": "600000.00", "currency": "UGX", "lease_id": null, "tenant_id": 12, "created_at": "2026-03-29T18:19:08.933Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 10, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-29T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "231", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-29 18:19:10.204163
198	1	invoice.payment.apply	invoice	922	{"id": 922, "amount": "1000000.00", "status": "open", "unit_id": 12, "currency": "UGX", "due_date": "2026-03-29T00:00:00.000Z", "lease_id": null, "tenant_id": 12, "created_at": "2026-03-29T18:17:48.960Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 9, "outstanding": "1000000.00", "paid_amount": "0.00", "property_id": 10, "tenant_name": "Mark Mugisha", "invoice_date": "2026-03-29T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "property_name": "USMall2", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 922, "amount": "1000000.00", "status": "open", "unit_id": 12, "currency": "UGX", "due_date": "2026-03-29T00:00:00.000Z", "lease_id": null, "tenant_id": 12, "created_at": "2026-03-29T18:17:48.960Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "600000.00", "property_id": 10, "invoice_date": "2026-03-29T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-29 18:19:10.263896
199	1	cil.accounting.upsert	transaction	70	\N	{"id": 70, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 12, "invoice_id": 922, "property_id": 10}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "400000.00", "currency": "UGX", "source_id": 922, "created_at": "2026-03-29T18:19:56.393Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 10, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-29 18:19:56.455373
200	1	cil.accounting.upsert	transaction	71	\N	{"id": 71, "cil": {"source": {"sourceEntity": {"type": "mgmt_fee_reversal", "invoice_id": 922, "property_id": 10}, "sourceModule": "accounting", "businessEvent": "MANAGEMENT_FEE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 14}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "management_fee_revenue", "creditIntent": "landlord_liability"}, "amount": "40000.00", "currency": "UGX", "source_id": 922, "created_at": "2026-03-29T18:19:56.810Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee reversal - Arrears before lease date.", "landlord_id": null, "property_id": 10, "source_type": "mgmt_fee_reversal", "expense_scope": null, "debit_account_id": 14, "reference_number": null, "transaction_date": "2026-03-29T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-03-29 18:19:56.870421
201	1	landlord.create	landlord	10	\N	{"id": 10, "email": null, "phone": "07745", "title": null, "status": "active", "due_day": 12, "due_date": "2000-01-12T00:00:00.000Z", "end_date": null, "bank_name": null, "full_name": "Businessman", "created_at": "2026-03-30T06:00:53.308Z", "start_date": "2025-12-01T00:00:00.000Z", "payment_method": "mobile_money", "mobile_money_name": "Biz", "bank_account_title": null, "mobile_money_phone": "0987", "bank_account_number": null}	\N	2026-03-30 06:00:53.370393
202	1	properties.create	properties	11	\N	{"id": 11, "notes": null, "address": "Kyanja", "created_at": "2026-03-30T06:01:24.957Z", "created_by": 1, "landlord_id": 10, "total_units": 0, "property_name": "West Mall", "property_type": "Commercial", "management_fee_type": "percent", "management_fee_percent": "10.00", "management_fee_fixed_amount": null}	\N	2026-03-30 06:01:25.019339
203	1	units.create	units	13	\N	{"id": 13, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-30T06:01:37.825Z", "property_id": 11, "square_feet": null, "unit_number": "1", "deposit_amount": null, "monthly_rent_ugx": "1000000.00", "monthly_rent_usd": null}	\N	2026-03-30 06:01:37.945762
204	1	tenant.create	tenant	13	\N	{"id": 13, "email": null, "phone": "0899", "title": null, "status": "active", "full_name": "Supermarket", "created_at": "2026-03-30T06:02:22.542Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-30 06:02:25.43994
205	1	lease.create	lease	13	\N	{"id": 13, "status": "active", "unit_id": 13, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 13, "auto_renew": false, "created_at": "2026-03-30T06:02:22.603Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1000000.00", "deposit_amount": null}	\N	2026-03-30 06:02:25.498919
206	1	accounting.arrears.create	invoice	963	\N	{"id": 963, "amount": "600000.00", "status": "open", "unit_id": 13, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 13, "created_at": "2026-03-30T06:03:44.305Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 11, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-30 06:03:46.996844
207	1	cil.accounting.upsert	transaction	72	\N	{"id": 72, "cil": {"source": {"sourceEntity": {"id": 31, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "480000.00", "currency": "UGX", "source_id": 31, "created_at": "2026-03-30T06:04:54.082Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Supermarket - Arrears before lease date.", "landlord_id": 10, "property_id": 11, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "099", "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-30 06:04:54.145945
208	1	cil.accounting.upsert	transaction	73	\N	{"id": 73, "cil": {"source": {"sourceEntity": {"id": 13, "type": "landlord_deduction", "invoiceId": 963}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "48000.00", "currency": "UGX", "source_id": 13, "created_at": "2026-03-30T06:04:54.614Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 10, "property_id": 11, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-30 06:04:54.674731
209	1	payment.create	payment	31	\N	{"id": 31, "notes": null, "amount": "480000.00", "currency": "UGX", "lease_id": null, "tenant_id": 13, "created_at": "2026-03-30T06:04:51.774Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 11, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-30T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "099", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-30 06:04:54.73339
210	1	invoice.payment.apply	invoice	963	{"id": 963, "amount": "600000.00", "status": "open", "unit_id": 13, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 13, "created_at": "2026-03-30T06:03:44.305Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 10, "outstanding": "600000.00", "paid_amount": "0.00", "property_id": 11, "tenant_name": "Supermarket", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "West Mall", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 963, "amount": "600000.00", "status": "open", "unit_id": 13, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 13, "created_at": "2026-03-30T06:03:44.305Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "480000.00", "property_id": 11, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-30 06:04:54.79223
211	1	cil.accounting.upsert	transaction	74	\N	{"id": 74, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 13, "invoice_id": 963, "property_id": 11}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "120000.00", "currency": "UGX", "source_id": 963, "created_at": "2026-03-30T06:06:40.484Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 11, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-30 06:06:40.544384
212	1	units.create	units	14	\N	{"id": 14, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-30T06:44:39.988Z", "property_id": 11, "square_feet": null, "unit_number": "2", "deposit_amount": null, "monthly_rent_ugx": "500000.00", "monthly_rent_usd": null}	\N	2026-03-30 06:44:40.124044
213	1	tenant.create	tenant	14	\N	{"id": 14, "email": null, "phone": "0990", "title": null, "status": "active", "full_name": "Saloon", "created_at": "2026-03-30T06:45:37.444Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-30 06:45:40.453683
214	1	lease.create	lease	14	\N	{"id": 14, "status": "active", "unit_id": 14, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 14, "auto_renew": false, "created_at": "2026-03-30T06:45:37.504Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "500000.00", "deposit_amount": null}	\N	2026-03-30 06:45:40.514098
215	1	accounting.arrears.create	invoice	993	\N	{"id": 993, "amount": "400000.00", "status": "open", "unit_id": 14, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 14, "created_at": "2026-03-30T06:46:37.274Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 11, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-30 06:46:39.954258
216	1	cil.accounting.upsert	transaction	75	\N	{"id": 75, "cil": {"source": {"sourceEntity": {"id": 32, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "300000.00", "currency": "UGX", "source_id": 32, "created_at": "2026-03-30T06:48:05.646Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Saloon - Arrears before lease date.", "landlord_id": 10, "property_id": 11, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "123", "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-30 06:48:05.711342
217	1	cil.accounting.upsert	transaction	76	\N	{"id": 76, "cil": {"source": {"sourceEntity": {"id": 14, "type": "landlord_deduction", "invoiceId": 993}, "sourceModule": "payments", "businessEvent": "ARREARS_RECOVERY_FEE"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "30000.00", "currency": "UGX", "source_id": 14, "created_at": "2026-03-30T06:48:06.196Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fees on recovered arrears - February 2026", "landlord_id": 10, "property_id": 11, "source_type": "landlord_deduction", "expense_scope": "landlord", "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-03-30 06:48:06.256171
218	1	payment.create	payment	32	\N	{"id": 32, "notes": null, "amount": "300000.00", "currency": "UGX", "lease_id": null, "tenant_id": 14, "created_at": "2026-03-30T06:48:03.356Z", "description": "Arrears before lease date.", "is_reversed": false, "period_year": null, "property_id": 11, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-30T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "123", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-30 06:48:06.314728
219	1	invoice.payment.apply	invoice	993	{"id": 993, "amount": "400000.00", "status": "open", "unit_id": 14, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 14, "created_at": "2026-03-30T06:46:37.274Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "landlord_id": 10, "outstanding": "400000.00", "paid_amount": "0.00", "property_id": 11, "tenant_name": "Saloon", "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "property_name": "West Mall", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 993, "amount": "400000.00", "status": "open", "unit_id": 14, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 14, "created_at": "2026-03-30T06:46:37.274Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "300000.00", "property_id": 11, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-30 06:48:06.373696
231	1	accounting.manual_invoice.create	invoice	2251	\N	{"id": 2251, "amount": "250000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-20T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-03-31T14:22:48.527Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent 20th-28th Feb", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-20T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-31 14:22:51.551812
220	1	cil.accounting.upsert	transaction	77	\N	{"id": 77, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 14, "invoice_id": 993, "property_id": 11}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": 993, "created_at": "2026-03-30T07:00:19.994Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 11, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-30 07:00:20.060523
221	1	properties.create	properties	12	\N	{"id": 12, "notes": null, "address": "Kansanga", "created_at": "2026-03-30T08:43:55.297Z", "created_by": 1, "landlord_id": 8, "total_units": 0, "property_name": "UK Mall", "property_type": "Commercial", "management_fee_type": "fixed", "management_fee_percent": null, "management_fee_fixed_amount": "300000.00"}	\N	2026-03-30 08:43:55.374155
222	1	units.create	units	15	\N	{"id": 15, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-03-30T08:45:29.961Z", "property_id": 12, "square_feet": null, "unit_number": "Uk-1", "deposit_amount": null, "monthly_rent_ugx": "1000000.00", "monthly_rent_usd": null}	\N	2026-03-30 08:45:30.109636
223	1	tenant.create	tenant	15	\N	{"id": 15, "email": null, "phone": "07720000", "title": null, "status": "active", "full_name": "Namara", "created_at": "2026-03-30T08:47:44.454Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-03-30 08:47:47.60558
224	1	lease.create	lease	15	\N	{"id": 15, "status": "active", "unit_id": 15, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 15, "auto_renew": false, "created_at": "2026-03-30T08:47:44.521Z", "created_by": 1, "start_date": "2026-03-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "1000000.00", "deposit_amount": null}	\N	2026-03-30 08:47:47.670282
225	1	accounting.arrears.create	invoice	1146	\N	{"id": 1146, "amount": "800000.00", "status": "open", "unit_id": 15, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": null, "tenant_id": 15, "created_at": "2026-03-30T08:49:58.509Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Arrears before lease date.", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-30 08:50:01.164378
226	1	cil.accounting.upsert	transaction	78	\N	{"id": 78, "cil": {"source": {"sourceEntity": {"id": 33, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "400000.00", "currency": "UGX", "source_id": 33, "created_at": "2026-03-30T08:51:07.273Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Namara - UK Mall", "landlord_id": 8, "property_id": 12, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "908", "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-30 08:51:07.344517
227	1	payment.create	payment	33	\N	{"id": 33, "notes": null, "amount": "400000.00", "currency": "UGX", "lease_id": 15, "tenant_id": 15, "created_at": "2026-03-30T08:51:05.130Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 12, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-30T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "908", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-30 08:51:07.402621
228	1	cil.accounting.upsert	transaction	79	\N	{"id": 79, "cil": {"source": {"sourceEntity": {"type": "rent_reversal", "tenant_id": 15, "invoice_id": 1146, "property_id": 12}, "sourceModule": "accounting", "businessEvent": "RENT_INVOICE_REVERSED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "landlord_liability", "creditIntent": "tenant_receivable"}, "amount": "400000.00", "currency": "UGX", "source_id": 1146, "created_at": "2026-03-30T08:53:19.040Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent invoice reversal - Arrears before lease date.", "landlord_id": null, "property_id": 12, "source_type": "rent_reversal", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-03-30 08:53:19.100824
229	1	cil.accounting.upsert	transaction	80	\N	{"id": 80, "cil": {"source": {"sourceEntity": {"id": 34, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "750000.00", "currency": "UGX", "source_id": 34, "created_at": "2026-03-31T13:44:25.688Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Basinga Josephine - Galaxy Heights", "landlord_id": 2, "property_id": 2, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "89", "transaction_date": "2026-03-31T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-03-31 13:44:25.754157
230	1	payment.create	payment	34	\N	{"id": 34, "notes": null, "amount": "750000.00", "currency": "UGX", "lease_id": 3, "tenant_id": 3, "created_at": "2026-03-31T13:44:23.466Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 2, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-03-31T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "89", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-03-31 13:44:25.816981
232	1	accounting.manual_invoice.create	invoice	2269	\N	{"id": 2269, "amount": "321000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-03-31T14:49:15.668Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Manual invoice testing", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-03-31 14:49:18.47668
233	1	accounting.manual_invoice.create	invoice	6899	\N	{"id": 6899, "amount": "43000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T08:29:20.884Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Adjusting Invoice for 20th - 28th Feb 26.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 08:29:23.692072
234	1	invoice.delete	invoice	870	{"id": 870, "amount": "700000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-03-29T17:04:29.960Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 870, "amount": "700000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-03-29T17:04:29.960Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:18:00.814822
235	1	invoice.delete	invoice	2610	{"id": 2610, "amount": "700000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-04-01T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T06:11:40.075Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: April 2026", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-04-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 4, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 2610, "amount": "700000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-04-01T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T06:11:40.075Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: April 2026", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-04-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 4, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:18:14.419983
236	1	invoice.delete	invoice	2269	{"id": 2269, "amount": "321000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-03-31T14:49:15.668Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Manual invoice testing", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 2269, "amount": "321000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-03-31T14:49:15.668Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Manual invoice testing", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:18:31.083214
237	1	invoice.delete	invoice	6899	{"id": 6899, "amount": "43000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T08:29:20.884Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Adjusting Invoice for 20th - 28th Feb 26.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 6899, "amount": "43000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-02-28T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T08:29:20.884Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Adjusting Invoice for 20th - 28th Feb 26.", "paid_amount": "0.00", "property_id": 8, "invoice_date": "2026-02-28T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:18:51.180725
238	1	units.create	units	16	\N	{"id": 16, "photos": [], "status": "vacant", "bedrooms": null, "bathrooms": null, "created_at": "2026-04-01T09:32:12.087Z", "property_id": 12, "square_feet": null, "unit_number": "Uk-2", "deposit_amount": null, "monthly_rent_ugx": "50000.00", "monthly_rent_usd": null}	\N	2026-04-01 09:32:12.208819
239	1	tenant.create	tenant	16	\N	{"id": 16, "email": null, "phone": "0897000", "title": null, "status": "active", "full_name": "Rachel", "created_at": "2026-04-01T09:33:39.909Z", "national_id": null, "emergency_phone": null, "emergency_contact": null}	\N	2026-04-01 09:33:42.786045
240	1	lease.create	lease	16	\N	{"id": 16, "status": "active", "unit_id": 16, "currency": "UGX", "end_date": "2099-12-31T00:00:00.000Z", "tenant_id": 16, "auto_renew": false, "created_at": "2026-04-01T09:33:39.968Z", "created_by": 1, "start_date": "2026-02-01T00:00:00.000Z", "billing_day": 1, "deposit_paid": "0.00", "monthly_rent": "50000.00", "deposit_amount": null}	\N	2026-04-01 09:33:42.844876
241	1	accounting.manual_invoice.create	invoice	7709	\N	{"id": 7709, "amount": "30000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-01-30T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:34:54.698Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Adjusting entry", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-01-30T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 1, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:34:57.510463
242	1	invoice.delete	invoice	7706	{"id": 7706, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-02-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:33:40.151Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: February 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-02-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 7706, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-02-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:33:40.151Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: February 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-02-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:35:35.38796
243	1	invoice.delete	invoice	7707	{"id": 7707, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:33:40.151Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 7707, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:33:40.151Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:35:46.981263
244	1	invoice.delete	invoice	7741	{"id": 7741, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-02-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:39:11.763Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: February 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-02-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 7741, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-02-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:39:11.763Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: February 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-02-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 2, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:57:42.961687
245	1	invoice.delete	invoice	7742	{"id": 7742, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:39:11.763Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 7742, "amount": "50000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:39:11.763Z", "deleted_at": null, "deleted_by": null, "is_deleted": true, "description": "Rent for: March 2026", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:57:51.218082
246	1	accounting.manual_invoice.create	invoice	7774	\N	{"id": 7774, "amount": "20000.00", "status": "open", "unit_id": 16, "currency": "UGX", "due_date": "2026-03-31T00:00:00.000Z", "lease_id": 16, "tenant_id": 16, "created_at": "2026-04-01T09:59:53.897Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Second adjusting entry for testing", "paid_amount": "0.00", "property_id": 12, "invoice_date": "2026-03-31T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-01 09:59:56.707922
247	1	cil.accounting.upsert	transaction	81	\N	{"id": 81, "cil": {"source": {"sourceEntity": {"id": 4, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 2}}, "debitIntent": "landlord_liability", "creditIntent": "bank_account"}, "amount": "100000.00", "currency": "UGX", "source_id": 4, "created_at": "2026-04-01T11:16:12.253Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Bank Account - Operating", "landlord_id": 6, "property_id": 7, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 2, "deposited_by_transaction_id": null}	\N	2026-04-01 11:16:12.319932
248	1	landlord.payout.create	landlord_payout	4	\N	{"id": 4, "notes": null, "amount": "100000.00", "created_at": "2026-04-01T11:16:11.785Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 6, "payout_date": "2026-04-01T00:00:00.000Z", "property_id": 7, "payment_method": "Bank Account - Operating", "reference_number": null}	\N	2026-04-01 11:16:12.382014
249	1	accounting.deposit.create	transaction	82	\N	{"id": 82, "amount": 3400000, "currency": "UGX", "source_id": null, "created_at": "2026-04-01T11:18:12.026867", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Multiple tenants - Multiple periods", "landlord_id": null, "property_id": null, "source_type": "deposit", "expense_scope": null, "transaction_ids": [49, 52, 55, 58, 61, 64], "debit_account_id": 1, "reference_number": null, "transaction_date": "2026-04-01", "credit_account_id": 3, "deposited_by_transaction_id": null}	\N	2026-04-01 11:18:12.096517
250	1	cil.accounting.upsert	transaction	83	\N	{"id": 83, "cil": {"source": {"sourceEntity": {"id": 5, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 1}}, "debitIntent": "landlord_liability", "creditIntent": "cash_account"}, "amount": "1145000.00", "currency": "UGX", "source_id": 5, "created_at": "2026-04-01T11:20:01.278Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Cash on Hand", "landlord_id": 4, "property_id": 4, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 1, "deposited_by_transaction_id": null}	\N	2026-04-01 11:20:01.338479
251	1	landlord.payout.create	landlord_payout	5	\N	{"id": 5, "notes": null, "amount": "1145000.00", "created_at": "2026-04-01T11:20:00.791Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 4, "payout_date": "2026-03-01T00:00:00.000Z", "property_id": 4, "payment_method": "Cash on Hand", "reference_number": null}	\N	2026-04-01 11:20:01.403446
252	1	cil.accounting.upsert	transaction	84	\N	{"id": 84, "cil": {"source": {"sourceEntity": {"id": 6, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 1}}, "debitIntent": "landlord_liability", "creditIntent": "cash_account"}, "amount": "500000.00", "currency": "UGX", "source_id": 6, "created_at": "2026-04-01T11:28:33.562Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Cash on Hand", "landlord_id": 8, "property_id": 12, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-17T00:00:00.000Z", "credit_account_id": 1, "deposited_by_transaction_id": null}	\N	2026-04-01 11:28:33.622241
253	1	landlord.payout.create	landlord_payout	6	\N	{"id": 6, "notes": null, "amount": "500000.00", "created_at": "2026-04-01T11:28:33.095Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 8, "payout_date": "2026-03-17T00:00:00.000Z", "property_id": 12, "payment_method": "Cash on Hand", "reference_number": null}	\N	2026-04-01 11:28:33.68094
254	1	cil.accounting.upsert	transaction	85	\N	{"id": 85, "cil": {"source": {"sourceEntity": {"id": 35, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "700000.00", "currency": "UGX", "source_id": 35, "created_at": "2026-04-02T07:20:07.997Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Sweep - Beautiful", "landlord_id": 7, "property_id": 8, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "567", "transaction_date": "2026-04-02T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-04-02 07:20:08.063815
255	1	payment.create	payment	35	\N	{"id": 35, "notes": null, "amount": "700000.00", "currency": "UGX", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-02T07:20:05.865Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 8, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-04-02T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "567", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-04-02 07:20:08.127237
256	1	cil.accounting.upsert	transaction	86	\N	{"id": 86, "cil": {"source": {"sourceEntity": {"id": 7, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 2}}, "debitIntent": "landlord_liability", "creditIntent": "bank_account"}, "amount": "402000.00", "currency": "UGX", "source_id": 7, "created_at": "2026-04-02T10:22:44.714Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Bank Account - Operating", "landlord_id": 10, "property_id": 11, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-03-31T00:00:00.000Z", "credit_account_id": 2, "deposited_by_transaction_id": null}	\N	2026-04-02 10:22:44.780235
257	1	landlord.payout.create	landlord_payout	7	\N	{"id": 7, "notes": null, "amount": "402000.00", "created_at": "2026-04-02T10:22:44.187Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 10, "payout_date": "2026-03-31T00:00:00.000Z", "property_id": 11, "payment_method": "Bank Account - Operating", "reference_number": null}	\N	2026-04-02 10:22:44.843341
258	1	cil.accounting.upsert	transaction	87	\N	{"id": 87, "cil": {"source": {"sourceEntity": {"id": 8, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 1}}, "debitIntent": "landlord_liability", "creditIntent": "cash_account"}, "amount": "560000.00", "currency": "UGX", "source_id": 8, "created_at": "2026-04-02T13:08:35.366Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - Divine", "landlord_id": 6, "property_id": 7, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": "Payment to Divine", "transaction_date": "2026-03-31T00:00:00.000Z", "credit_account_id": 1, "deposited_by_transaction_id": null}	\N	2026-04-02 13:08:35.431532
259	1	landlord.payout.create	landlord_payout	8	\N	{"id": 8, "notes": null, "amount": "560000.00", "created_at": "2026-04-02T13:08:34.774Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 6, "payout_date": "2026-03-31T00:00:00.000Z", "property_id": 7, "payment_method": "Cash on Hand", "reference_number": "Payment to Divine"}	\N	2026-04-02 13:08:35.495853
260	1	landlord.payout.update	landlord_payout	8	{"id": 8, "notes": null, "amount": "500000.00", "created_at": "2026-04-02T13:08:34.774Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 6, "payout_date": "2026-03-31T00:00:00.000Z", "property_id": 7, "payment_method": "Cash on Hand", "reference_number": "Payment to Divine"}	{"id": 8, "notes": null, "amount": "450000.00", "created_at": "2026-04-02T13:08:34.774Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 6, "payout_date": "2026-03-31T00:00:00.000Z", "property_id": 7, "payment_method": "Cash on Hand", "reference_number": "Payment to Divine"}	\N	2026-04-02 13:21:10.646954
261	1	accounting.transfer.create	transaction	88	\N	{"id": 88, "amount": "1000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-02T13:52:11.271Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Cash withdrawal", "landlord_id": null, "property_id": null, "source_type": "manual", "expense_scope": null, "debit_account_id": 1, "reference_number": "TRANSFER-1775137931238", "transaction_date": "2026-04-02T00:00:00.000Z", "credit_account_id": 2, "deposited_by_transaction_id": null}	\N	2026-04-02 13:52:11.334227
262	1	accounting.deposit.create	transaction	89	\N	{"id": 89, "amount": 8660000, "currency": "UGX", "source_id": null, "created_at": "2026-04-02T15:56:11.849546", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Multiple tenants - Multiple periods", "landlord_id": null, "property_id": null, "source_type": "deposit", "expense_scope": null, "transaction_ids": [3, 9, 12, 13, 15, 19, 43, 49, 52, 55, 58, 61, 64, 68, 72, 75, 78, 80, 85], "debit_account_id": 1, "reference_number": null, "transaction_date": "2026-04-02", "credit_account_id": 3, "deposited_by_transaction_id": null}	\N	2026-04-02 15:56:11.916059
263	1	cil.accounting.upsert	transaction	90	\N	{"id": 90, "cil": {"source": {"sourceEntity": {"id": 9, "type": "landlord_payout"}, "sourceModule": "property", "businessEvent": "LANDLORD_PAID"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 1}}, "debitIntent": "landlord_liability", "creditIntent": "cash_account"}, "amount": "1165000.00", "currency": "UGX", "source_id": 9, "created_at": "2026-04-02T15:56:54.864Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Landlord payout - New", "landlord_id": 7, "property_id": 8, "source_type": "landlord_payout", "expense_scope": null, "debit_account_id": 7, "reference_number": null, "transaction_date": "2026-04-02T00:00:00.000Z", "credit_account_id": 1, "deposited_by_transaction_id": null}	\N	2026-04-02 15:56:54.923376
264	1	landlord.payout.create	landlord_payout	9	\N	{"id": 9, "notes": null, "amount": "1165000.00", "created_at": "2026-04-02T15:56:54.394Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 7, "payout_date": "2026-04-02T00:00:00.000Z", "property_id": 8, "payment_method": "Cash on Hand", "reference_number": null}	\N	2026-04-02 15:56:54.983637
265	1	landlord.payout.update	landlord_payout	9	{"id": 9, "notes": null, "amount": "1165000.00", "created_at": "2026-04-02T15:56:54.394Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 7, "payout_date": "2026-04-02T00:00:00.000Z", "property_id": 8, "payment_method": "Cash on Hand", "reference_number": null}	{"id": 9, "notes": null, "amount": "1165000.00", "created_at": "2026-04-02T15:56:54.394Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "landlord_id": 7, "payout_date": "2026-03-31T00:00:00.000Z", "property_id": 8, "payment_method": "Cash on Hand", "reference_number": null}	\N	2026-04-02 15:57:48.521109
266	1	cil.accounting.upsert	transaction	91	\N	{"id": 91, "cil": {"source": {"sourceEntity": {"id": 36, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "250000.00", "currency": "UGX", "source_id": 36, "created_at": "2026-04-06T11:47:44.241Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent Collection - Sweep - Rent for: March 2026", "landlord_id": 7, "property_id": 8, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": null, "transaction_date": "2026-04-06T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-06 11:47:44.308188
267	1	payment.create	payment	36	\N	{"id": 36, "notes": null, "amount": "250000.00", "currency": "UGX", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-06T11:47:43.688Z", "description": "Rent for: March 2026", "is_reversed": false, "period_year": null, "property_id": 8, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-04-06T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": null, "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-04-06 11:47:44.441539
268	1	invoice.payment.apply	invoice	7694	{"id": 7694, "amount": "700000.00", "status": "open", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T09:28:48.437Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: March 2026", "landlord_id": 7, "outstanding": "250000.00", "paid_amount": "450000.00", "property_id": 8, "tenant_name": "Sweep", "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "property_name": "Beautiful", "commission_rate": "0.00", "commission_amount": "0.00"}	{"id": 7694, "amount": "700000.00", "status": "paid", "unit_id": 10, "currency": "UGX", "due_date": "2026-03-01T00:00:00.000Z", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-01T09:28:48.437Z", "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent for: March 2026", "paid_amount": "700000.00", "property_id": 8, "invoice_date": "2026-03-01T00:00:00.000Z", "invoice_year": 2026, "invoice_month": 3, "commission_rate": "0.00", "commission_amount": "0.00"}	\N	2026-04-06 11:47:44.501644
269	1	cil.accounting.upsert	transaction	92	\N	{"id": 92, "cil": {"source": {"sourceEntity": {"id": 37, "type": "payment"}, "sourceModule": "property", "businessEvent": "TENANT_ADVANCE_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 8}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_prepayments"}, "amount": "850000.00", "currency": "UGX", "source_id": 37, "created_at": "2026-04-06T13:53:13.002Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Payment on Account - Sweep - Beautiful", "landlord_id": 7, "property_id": 8, "source_type": "payment_advance", "expense_scope": null, "debit_account_id": 3, "reference_number": "452", "transaction_date": "2026-04-06T00:00:00.000Z", "credit_account_id": 8, "deposited_by_transaction_id": null}	\N	2026-04-06 13:53:13.062662
270	1	payment.create	payment	37	\N	{"id": 37, "notes": null, "amount": "850000.00", "currency": "UGX", "lease_id": 10, "tenant_id": 10, "created_at": "2026-04-06T13:53:10.856Z", "description": "Payment on Account", "is_reversed": false, "period_year": null, "property_id": 8, "recorded_by": 1, "reversed_at": null, "reversed_by": null, "deposited_at": null, "payment_date": "2026-04-06T00:00:00.000Z", "period_month": null, "payment_method": "MTN MoMo", "reference_number": "452", "deposit_transaction_id": null, "deposited_to_account_id": null}	\N	2026-04-06 13:53:13.121812
271	1	cil.accounting.upsert	transaction	93	\N	{"id": 93, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 1, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": 1, "created_at": "2026-04-07T14:16:33.783Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:1", "transaction_date": "2026-03-23T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:33.854528
272	1	cil.accounting.upsert	transaction	94	\N	{"id": 94, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 2, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": 2, "created_at": "2026-04-07T14:16:34.507Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:2", "transaction_date": "2026-03-23T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:34.56675
273	1	cil.accounting.upsert	transaction	95	\N	{"id": 95, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 3, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "100000.00", "currency": "UGX", "source_id": 3, "created_at": "2026-04-07T14:16:35.211Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:3", "transaction_date": "2026-03-23T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:35.270689
274	1	cil.accounting.upsert	transaction	96	\N	{"id": 96, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 4, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "2000000.00", "currency": "UGX", "source_id": 4, "created_at": "2026-04-07T14:16:35.913Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:4", "transaction_date": "2026-03-23T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:35.977639
275	1	cil.accounting.upsert	transaction	97	\N	{"id": 97, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 5, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "245000.00", "currency": "UGX", "source_id": 5, "created_at": "2026-04-07T14:16:36.621Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:5", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:36.680468
276	1	cil.accounting.upsert	transaction	98	\N	{"id": 98, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 6, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "440000.00", "currency": "UGX", "source_id": 6, "created_at": "2026-04-07T14:16:37.321Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:6", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:37.380458
277	1	cil.accounting.upsert	transaction	99	\N	{"id": 99, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 7, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "55000.00", "currency": "UGX", "source_id": 7, "created_at": "2026-04-07T14:16:38.045Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:7", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:38.104717
278	1	cil.accounting.upsert	transaction	100	\N	{"id": 100, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 8, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "400000.00", "currency": "UGX", "source_id": 8, "created_at": "2026-04-07T14:16:38.752Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:8", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:38.811752
279	1	cil.accounting.upsert	transaction	101	\N	{"id": 101, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 9, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "200000.00", "currency": "UGX", "source_id": 9, "created_at": "2026-04-07T14:16:39.456Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:9", "transaction_date": "2026-03-24T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:39.605338
280	1	cil.accounting.upsert	transaction	102	\N	{"id": 102, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 10, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "300000.00", "currency": "UGX", "source_id": 10, "created_at": "2026-04-07T14:16:40.262Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:10", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:40.322148
281	1	cil.accounting.upsert	transaction	103	\N	{"id": 103, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 11, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "157000.00", "currency": "UGX", "source_id": 11, "created_at": "2026-04-07T14:16:40.963Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:11", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:41.022757
282	1	cil.accounting.upsert	transaction	104	\N	{"id": 104, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 12, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "3000.00", "currency": "UGX", "source_id": 12, "created_at": "2026-04-07T14:16:41.667Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:12", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:41.726013
283	1	cil.accounting.upsert	transaction	105	\N	{"id": 105, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 13, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "240000.00", "currency": "UGX", "source_id": 13, "created_at": "2026-04-07T14:16:42.368Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:13", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:42.427273
284	1	cil.accounting.upsert	transaction	106	\N	{"id": 106, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 14, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "110000.00", "currency": "UGX", "source_id": 14, "created_at": "2026-04-07T14:16:43.066Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Rwatamagufa Kachope", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:14", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:43.126254
285	1	cil.accounting.upsert	transaction	107	\N	{"id": 107, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 16, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "390000.00", "currency": "UGX", "source_id": 16, "created_at": "2026-04-07T14:16:43.944Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Magufuli", "landlord_id": 1, "property_id": 1, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:16", "transaction_date": "2026-03-25T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:44.004952
286	1	cil.accounting.upsert	transaction	108	\N	{"id": 108, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 33, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "400000.00", "currency": "UGX", "source_id": 33, "created_at": "2026-04-07T14:16:47.390Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Namara", "landlord_id": 8, "property_id": 12, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:33", "transaction_date": "2026-03-30T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:47.451369
290	1	historical_backfill.run	historical_backfill	\N	\N	{"to": null, "from": null, "stats": {"payouts": {"errors": 0, "posted": 0, "scanned": 7, "skipped": 0, "linkedExisting": 7}, "payments": {"errors": 0, "posted": 19, "scanned": 36, "skipped": 0, "linkedExisting": 17}, "rentAccrual": {"voided": 0, "skipped": 1, "updated": 0, "inserted": 0}, "tenantDeductions": {"errors": 0, "posted": 0, "scanned": 0, "skipped": 0, "linkedExisting": 0}, "landlordDeductions": {"errors": 0, "posted": 0, "scanned": 13, "skipped": 0, "linkedExisting": 13}}, "dryRun": false, "errorsCount": 0, "includePayouts": true, "includePayments": true, "includeDeductions": true}	\N	2026-04-07 14:16:53.621669
291	1	historical_backfill.run	historical_backfill	\N	\N	{"to": null, "from": null, "stats": {"payouts": {"errors": 0, "posted": 0, "scanned": 7, "skipped": 7, "linkedExisting": 0}, "payments": {"errors": 0, "posted": 0, "scanned": 36, "skipped": 36, "linkedExisting": 0}, "rentAccrual": {"voided": 0, "skipped": 1, "updated": 0, "inserted": 0}, "tenantDeductions": {"errors": 0, "posted": 0, "scanned": 0, "skipped": 0, "linkedExisting": 0}, "landlordDeductions": {"errors": 0, "posted": 0, "scanned": 13, "skipped": 13, "linkedExisting": 0}}, "dryRun": false, "errorsCount": 0, "includePayouts": true, "includePayments": true, "includeDeductions": true}	\N	2026-04-07 15:00:04.624646
292	\N	cil.accounting.upsert	transaction	112	\N	{"id": 112, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1790000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:27.969Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tester - December 2025", "landlord_id": 1, "property_id": 1, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:1:2025-12:UGX", "transaction_date": "2025-12-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:28.030221
293	\N	cil.accounting.upsert	transaction	113	\N	{"id": 113, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:28.439Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tester - December 2025", "landlord_id": 1, "property_id": 1, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:1:2025-12:UGX", "transaction_date": "2025-12-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:28.500226
294	\N	cil.accounting.upsert	transaction	114	\N	{"id": 114, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1900000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:28.911Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tester - January 2026", "landlord_id": 1, "property_id": 1, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:1:2026-01:UGX", "transaction_date": "2026-01-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:28.971834
295	\N	cil.accounting.upsert	transaction	115	\N	{"id": 115, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:29.381Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tester - January 2026", "landlord_id": 1, "property_id": 1, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:1:2026-01:UGX", "transaction_date": "2026-01-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:29.440964
287	1	cil.accounting.upsert	transaction	109	\N	{"id": 109, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 34, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "750000.00", "currency": "UGX", "source_id": 34, "created_at": "2026-04-07T14:16:48.090Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Basinga Josephine", "landlord_id": 2, "property_id": 2, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:34", "transaction_date": "2026-03-31T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:48.150094
288	1	cil.accounting.upsert	transaction	110	\N	{"id": 110, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 35, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "250000.00", "currency": "UGX", "source_id": 35, "created_at": "2026-04-07T14:16:48.794Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Sweep", "landlord_id": 7, "property_id": 8, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:35", "transaction_date": "2026-04-02T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:48.853848
289	1	cil.accounting.upsert	transaction	111	\N	{"id": 111, "cil": {"source": {"source": "historical_backfill", "sourceEntity": {"id": 37, "type": "payment"}, "businessEvent": "TENANT_PAYMENT_RECEIVED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 3}, "credit": {"ok": true, "method": "heuristic", "accountId": 4}}, "debitIntent": "undeposited_funds", "creditIntent": "tenant_receivable"}, "amount": "600000.00", "currency": "UGX", "source_id": 37, "created_at": "2026-04-07T14:16:49.689Z", "created_by": 1, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent collection - Sweep", "landlord_id": 7, "property_id": 8, "source_type": "payment", "expense_scope": null, "debit_account_id": 3, "reference_number": "PAYMENT:37", "transaction_date": "2026-04-06T00:00:00.000Z", "credit_account_id": 4, "deposited_by_transaction_id": null}	\N	2026-04-07 14:16:49.748939
296	\N	cil.accounting.upsert	transaction	116	\N	{"id": 116, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1999000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:29.851Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tester - February 2026", "landlord_id": 1, "property_id": 1, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:1:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:29.911514
297	\N	cil.accounting.upsert	transaction	117	\N	{"id": 117, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:30.322Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tester - February 2026", "landlord_id": 1, "property_id": 1, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:1:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:30.382306
298	\N	cil.accounting.upsert	transaction	118	\N	{"id": 118, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "400000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:30.792Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tester - March 2026", "landlord_id": 1, "property_id": 1, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:1:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:30.851142
299	\N	cil.accounting.upsert	transaction	119	\N	{"id": 119, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:31.260Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tester - March 2026", "landlord_id": 1, "property_id": 1, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:1:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:31.319471
300	\N	cil.accounting.upsert	transaction	120	\N	{"id": 120, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1900000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:31.732Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tester - April 2026", "landlord_id": 1, "property_id": 1, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:1:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:31.792183
301	\N	cil.accounting.upsert	transaction	121	\N	{"id": 121, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:32.202Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tester - April 2026", "landlord_id": 1, "property_id": 1, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:1:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:32.262465
302	\N	cil.accounting.upsert	transaction	122	\N	{"id": 122, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "911000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:32.674Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Galaxy Heights - February 2026", "landlord_id": 2, "property_id": 2, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:2:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:32.733711
303	\N	cil.accounting.upsert	transaction	123	\N	{"id": 123, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "91100.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:33.143Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Galaxy Heights - February 2026", "landlord_id": 2, "property_id": 2, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:2:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:33.203653
304	\N	cil.accounting.upsert	transaction	124	\N	{"id": 124, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1150000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:33.613Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Galaxy Heights - March 2026", "landlord_id": 2, "property_id": 2, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:2:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:33.673716
305	\N	cil.accounting.upsert	transaction	125	\N	{"id": 125, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "115000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:34.085Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Galaxy Heights - March 2026", "landlord_id": 2, "property_id": 2, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:2:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:34.144736
306	\N	cil.accounting.upsert	transaction	126	\N	{"id": 126, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1150000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:34.552Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Galaxy Heights - April 2026", "landlord_id": 2, "property_id": 2, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:2:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:34.611577
307	\N	cil.accounting.upsert	transaction	127	\N	{"id": 127, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "115000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:35.019Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Galaxy Heights - April 2026", "landlord_id": 2, "property_id": 2, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:2:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:35.078789
308	\N	cil.accounting.upsert	transaction	128	\N	{"id": 128, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1107000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:35.490Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Danger Zone - February 2026", "landlord_id": 3, "property_id": 3, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:3:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:35.550844
309	\N	cil.accounting.upsert	transaction	129	\N	{"id": 129, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "110700.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:35.959Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Danger Zone - February 2026", "landlord_id": 3, "property_id": 3, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:3:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:36.017977
310	\N	cil.accounting.upsert	transaction	130	\N	{"id": 130, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "800000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:36.426Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Danger Zone - March 2026", "landlord_id": 3, "property_id": 3, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:3:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:36.486523
311	\N	cil.accounting.upsert	transaction	131	\N	{"id": 131, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "80000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:36.896Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Danger Zone - March 2026", "landlord_id": 3, "property_id": 3, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:3:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:36.955883
312	\N	cil.accounting.upsert	transaction	132	\N	{"id": 132, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "800000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:37.365Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Danger Zone - April 2026", "landlord_id": 3, "property_id": 3, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:3:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:37.425287
313	\N	cil.accounting.upsert	transaction	133	\N	{"id": 133, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "80000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:37.833Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Danger Zone - April 2026", "landlord_id": 3, "property_id": 3, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:3:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:37.892679
314	\N	cil.accounting.upsert	transaction	134	\N	{"id": 134, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "400000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:38.302Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Destiny - February 2026", "landlord_id": 4, "property_id": 4, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:4:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:38.361311
315	\N	cil.accounting.upsert	transaction	135	\N	{"id": 135, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "40000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:38.776Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Destiny - February 2026", "landlord_id": 4, "property_id": 4, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:4:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:38.835749
316	\N	cil.accounting.upsert	transaction	136	\N	{"id": 136, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "2200000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:39.243Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Destiny - March 2026", "landlord_id": 4, "property_id": 4, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:4:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:39.303547
317	\N	cil.accounting.upsert	transaction	137	\N	{"id": 137, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "220000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:39.713Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Destiny - March 2026", "landlord_id": 4, "property_id": 4, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:4:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:39.77213
318	\N	cil.accounting.upsert	transaction	138	\N	{"id": 138, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "2200000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:40.179Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Destiny - April 2026", "landlord_id": 4, "property_id": 4, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:4:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:40.239064
319	\N	cil.accounting.upsert	transaction	139	\N	{"id": 139, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "220000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:40.647Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Destiny - April 2026", "landlord_id": 4, "property_id": 4, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:4:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:40.707126
320	\N	cil.accounting.upsert	transaction	140	\N	{"id": 140, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "2000000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:41.131Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tested&Tried - March 2026", "landlord_id": 5, "property_id": 6, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:6:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:41.191404
321	\N	cil.accounting.upsert	transaction	141	\N	{"id": 141, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "200000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:41.600Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tested&Tried - March 2026", "landlord_id": 5, "property_id": 6, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:6:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:41.659397
322	\N	cil.accounting.upsert	transaction	142	\N	{"id": 142, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "2000000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:42.067Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Tested&Tried - April 2026", "landlord_id": 5, "property_id": 6, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:6:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:42.126868
323	\N	cil.accounting.upsert	transaction	143	\N	{"id": 143, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "200000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:42.534Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Tested&Tried - April 2026", "landlord_id": 5, "property_id": 6, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:6:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:42.594683
324	\N	cil.accounting.upsert	transaction	144	\N	{"id": 144, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1000000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:43.008Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Finance - March 2026", "landlord_id": 6, "property_id": 7, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:7:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:43.067565
325	\N	cil.accounting.upsert	transaction	145	\N	{"id": 145, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "100000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:43.476Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Finance - March 2026", "landlord_id": 6, "property_id": 7, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:7:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:43.535716
326	\N	cil.accounting.upsert	transaction	146	\N	{"id": 146, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1000000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:43.947Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Finance - April 2026", "landlord_id": 6, "property_id": 7, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:7:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:44.007132
327	\N	cil.accounting.upsert	transaction	147	\N	{"id": 147, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "100000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:44.419Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Finance - April 2026", "landlord_id": 6, "property_id": 7, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:7:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:44.478301
328	\N	cil.accounting.upsert	transaction	148	\N	{"id": 148, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "250000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:44.889Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Beautiful - February 2026", "landlord_id": 7, "property_id": 8, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:8:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:44.949856
329	\N	cil.accounting.upsert	transaction	149	\N	{"id": 149, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "25000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:45.362Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Beautiful - February 2026", "landlord_id": 7, "property_id": 8, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:8:2026-02:UGX", "transaction_date": "2026-02-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:45.421646
330	\N	cil.accounting.upsert	transaction	150	\N	{"id": 150, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "700000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:45.830Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Beautiful - March 2026", "landlord_id": 7, "property_id": 8, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:8:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:45.889367
331	\N	cil.accounting.upsert	transaction	151	\N	{"id": 151, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "70000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:46.302Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Beautiful - March 2026", "landlord_id": 7, "property_id": 8, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:8:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:46.360993
332	\N	cil.accounting.upsert	transaction	152	\N	{"id": 152, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "700000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:46.774Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - Beautiful - April 2026", "landlord_id": 7, "property_id": 8, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:8:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:46.83383
333	\N	cil.accounting.upsert	transaction	153	\N	{"id": 153, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "70000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:47.245Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - Beautiful - April 2026", "landlord_id": 7, "property_id": 8, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:8:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:47.303999
334	\N	cil.accounting.upsert	transaction	154	\N	{"id": 154, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "3000000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:47.711Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - US Mall - March 2026", "landlord_id": 8, "property_id": 9, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:9:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:47.770721
335	\N	cil.accounting.upsert	transaction	155	\N	{"id": 155, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:48.178Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - US Mall - March 2026", "landlord_id": 8, "property_id": 9, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:9:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:48.23784
336	\N	cil.accounting.upsert	transaction	156	\N	{"id": 156, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "3000000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:48.646Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - US Mall - April 2026", "landlord_id": 8, "property_id": 9, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:9:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:48.706075
337	\N	cil.accounting.upsert	transaction	157	\N	{"id": 157, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:49.123Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - US Mall - April 2026", "landlord_id": 8, "property_id": 9, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:9:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:49.182626
338	\N	cil.accounting.upsert	transaction	158	\N	{"id": 158, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1400000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:49.590Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - USMall2 - March 2026", "landlord_id": 9, "property_id": 10, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:10:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:49.649642
339	\N	cil.accounting.upsert	transaction	159	\N	{"id": 159, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "140000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:50.055Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - USMall2 - March 2026", "landlord_id": 9, "property_id": 10, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:10:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:50.11484
340	\N	cil.accounting.upsert	transaction	160	\N	{"id": 160, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1400000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:50.525Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - USMall2 - April 2026", "landlord_id": 9, "property_id": 10, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:10:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:50.583644
341	\N	cil.accounting.upsert	transaction	161	\N	{"id": 161, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "140000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:50.995Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - USMall2 - April 2026", "landlord_id": 9, "property_id": 10, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:10:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:51.054354
342	\N	cil.accounting.upsert	transaction	162	\N	{"id": 162, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1500000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:51.461Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - West Mall - March 2026", "landlord_id": 10, "property_id": 11, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:11:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:51.636943
343	\N	cil.accounting.upsert	transaction	163	\N	{"id": 163, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "150000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:53.783Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - West Mall - March 2026", "landlord_id": 10, "property_id": 11, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:11:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:53.842692
344	\N	cil.accounting.upsert	transaction	164	\N	{"id": 164, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1500000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:54.251Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - West Mall - April 2026", "landlord_id": 10, "property_id": 11, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:11:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:54.311013
345	\N	cil.accounting.upsert	transaction	165	\N	{"id": 165, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "150000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:54.718Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - West Mall - April 2026", "landlord_id": 10, "property_id": 11, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:11:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:54.779096
346	\N	cil.accounting.upsert	transaction	166	\N	{"id": 166, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "30000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:55.187Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - UK Mall - January 2026", "landlord_id": 8, "property_id": 12, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:12:2026-01:UGX", "transaction_date": "2026-01-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:55.246232
347	\N	cil.accounting.upsert	transaction	167	\N	{"id": 167, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "30000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:55.654Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - UK Mall - January 2026", "landlord_id": 8, "property_id": 12, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:12:2026-01:UGX", "transaction_date": "2026-01-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:55.714968
348	\N	cil.accounting.upsert	transaction	168	\N	{"id": 168, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1020000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:56.134Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - UK Mall - March 2026", "landlord_id": 8, "property_id": 12, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:12:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:56.193462
349	\N	cil.accounting.upsert	transaction	169	\N	{"id": 169, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:56.601Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - UK Mall - March 2026", "landlord_id": 8, "property_id": 12, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:12:2026-03:UGX", "transaction_date": "2026-03-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:56.660901
350	\N	cil.accounting.upsert	transaction	170	\N	{"id": 170, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "TENANT_INVOICED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 4}, "credit": {"ok": true, "method": "heuristic", "accountId": 7}}, "debitIntent": "tenant_receivable", "creditIntent": "landlord_liability"}, "amount": "1050000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:57.069Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Rent billed (gross) - UK Mall - April 2026", "landlord_id": 8, "property_id": 12, "source_type": "rent_accrual_summary", "expense_scope": null, "debit_account_id": 4, "reference_number": "RENT-ACCRUAL:12:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 7, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:57.12843
351	\N	cil.accounting.upsert	transaction	171	\N	{"id": 171, "cil": {"source": {"aggregation": "property_month", "sourceModule": "property", "businessEvent": "FEE_RECOGNIZED"}, "posting": "insert", "resolved": {"debit": {"ok": true, "method": "heuristic", "accountId": 7}, "credit": {"ok": true, "method": "heuristic", "accountId": 14}}, "debitIntent": "landlord_liability", "creditIntent": "management_fee_income"}, "amount": "300000.00", "currency": "UGX", "source_id": null, "created_at": "2026-04-07T15:14:57.537Z", "created_by": null, "deleted_at": null, "deleted_by": null, "is_deleted": false, "description": "Management fee - UK Mall - April 2026", "landlord_id": 8, "property_id": 12, "source_type": "mgmt_fee_summary", "expense_scope": null, "debit_account_id": 7, "reference_number": "MGMTFEE:12:2026-04:UGX", "transaction_date": "2026-04-01T00:00:00.000Z", "credit_account_id": 14, "deposited_by_transaction_id": null}	\N	2026-04-07 15:14:57.596061
352	1	historical_backfill.run	historical_backfill	\N	\N	{"to": null, "from": null, "stats": {"payouts": {"errors": 0, "posted": 0, "scanned": 7, "skipped": 7, "linkedExisting": 0}, "payments": {"errors": 0, "posted": 0, "scanned": 36, "skipped": 36, "linkedExisting": 0}, "rentAccrual": {"voided": 0, "skipped": 0, "updated": 0, "inserted": 60}, "tenantDeductions": {"errors": 0, "posted": 0, "scanned": 0, "skipped": 0, "linkedExisting": 0}, "landlordDeductions": {"errors": 0, "posted": 0, "scanned": 13, "skipped": 13, "linkedExisting": 0}}, "dryRun": false, "errorsCount": 0, "includePayouts": true, "includePayments": true, "includeDeductions": true}	\N	2026-04-07 15:15:01.34199

\.

COPY "auth_users" FROM stdin;
1	Mark Mugisha	mhmugisha@gmail.com	\N	\N

\.

COPY "auth_accounts" FROM stdin;
1	1	credentials	credentials	1	\N	\N	\N	\N	\N	\N	\N	$argon2id$v=19$m=65536,t=3,p=4$pUypJUvTRwtkaSthCN3ETA$lOqW5Ji+nIkwFfC2dgUJtvjXK4P95RrX/DrwgFExtbk

\.

COPY "chart_of_accounts" FROM stdin;
1	1110	Cash on Hand	Asset	\N	t	2026-03-23 16:21:34.798959
2	1120	Bank Account - Operating	Asset	\N	t	2026-03-23 16:21:34.798959
3	1130	Undeposited Funds	Asset	\N	t	2026-03-23 16:21:34.798959
4	1210	Accounts Receivable - Tenants	Asset	\N	t	2026-03-23 16:21:34.798959
5	1300	Tenant Deposits Held	Asset	\N	t	2026-03-23 16:21:34.798959
6	1400	Prepaid Expenses	Asset	\N	t	2026-03-23 16:21:34.798959
7	2100	Due to Landlords	Liability	\N	t	2026-03-23 16:21:34.798959
8	2150	Tenant Prepayments	Liability	\N	t	2026-03-23 16:21:34.798959
9	2200	Tenant Deposits Payable	Liability	\N	t	2026-03-23 16:21:34.798959
10	2300	Accounts Payable	Liability	\N	t	2026-03-23 16:21:34.798959
11	2400	Accrued Expenses	Liability	\N	t	2026-03-23 16:21:34.798959
12	3100	Owner's Equity	Equity	\N	t	2026-03-23 16:21:34.798959
13	3200	Retained Earnings	Equity	\N	t	2026-03-23 16:21:34.798959
14	4100	Management Fee Income	Income	\N	t	2026-03-23 16:21:34.798959
15	4200	Rental Income	Income	\N	t	2026-03-23 16:21:34.798959
16	4300	Late Fee Income	Income	\N	t	2026-03-23 16:21:34.798959
17	4400	Other Income	Income	\N	t	2026-03-23 16:21:34.798959
18	5110	Property Maintenance	Expense	\N	t	2026-03-23 16:21:34.798959
19	5120	Repairs & Maintenance	Expense	\N	t	2026-03-23 16:21:34.798959
20	5130	Utilities	Expense	\N	t	2026-03-23 16:21:34.798959
21	5140	Property Insurance	Expense	\N	t	2026-03-23 16:21:34.798959
22	5150	Property Taxes	Expense	\N	t	2026-03-23 16:21:34.798959
23	5210	Office Expenses	Expense	\N	t	2026-03-23 16:21:34.798959
24	5220	Professional Fees	Expense	\N	t	2026-03-23 16:21:34.798959
25	5230	Bank Charges	Expense	\N	t	2026-03-23 16:21:34.798959
26	5240	Software & Technology	Expense	\N	t	2026-03-23 16:21:34.798959

\.

COPY "properties" FROM stdin;
1	Tester	Testing	Commercial	2	\N	\N	1	2026-03-19 09:56:20.239896	1	fixed	300000.00
2	Galaxy Heights	Kyanja	Commercial	2	10.00	\N	1	2026-03-29 08:44:37.827585	2	percent	\N
3	Danger Zone	Stress street	Commercial	1	10.00	\N	1	2026-03-29 11:03:16.061571	3	percent	\N
4	Destiny	Heavenly	Commercial	2	10.00	\N	1	2026-03-29 14:35:09.910799	4	percent	\N
6	Tested&Tried	Bwaise	Commercial	1	10.00	\N	1	2026-03-29 15:36:10.054755	5	percent	\N
7	Finance	Area	Commercial	1	10.00	\N	1	2026-03-29 16:07:52.220967	6	percent	\N
8	Beautiful	Gate	Commercial	1	10.00	\N	1	2026-03-29 17:03:36.494988	7	percent	\N
9	US Mall	Kyanja	Commercial	1	10.00	\N	1	2026-03-29 17:31:07.436693	8	percent	\N
10	USMall2	Kensington	Commercial	1	10.00	\N	1	2026-03-29 18:15:41.408181	9	percent	\N
11	West Mall	Kyanja	Commercial	2	10.00	\N	1	2026-03-30 06:01:24.957862	10	percent	\N
12	UK Mall	Kansanga	Commercial	2	\N	\N	1	2026-03-30 08:43:55.297451	8	fixed	300000.00

\.

COPY "tenants" FROM stdin;
1	Magufuli	078000000	\N	\N	\N	\N	active	2026-03-19 09:57:42.928764	\N
2	Rwatamagufa Kachope	076000000	\N	\N	\N	\N	active	2026-03-24 09:55:14.048248	\N
3	Basinga Josephine	0789000000	\N	\N	\N	\N	active	2026-03-29 09:15:04.97961	\N
4	Trial Tenant	0776000000	\N	\N	\N	\N	active	2026-03-29 10:54:31.574637	\N
5	Fun Fanatic	078900000	\N	\N	\N	\N	active	2026-03-29 11:05:12.487064	\N
6	Congratulations	07768	\N	\N	\N	\N	active	2026-03-29 14:36:15.996307	\N
7	We Made it	08971	\N	\N	\N	\N	active	2026-03-29 14:36:47.046551	\N
8	Beloved	0788000	\N	\N	\N	\N	active	2026-03-29 15:37:09.378573	\N
9	Eliezer	07800	\N	\N	\N	\N	active	2026-03-29 16:08:59.773719	\N
10	Sweep	0987	\N	\N	\N	\N	active	2026-03-29 17:04:29.701196	\N
11	Latitude	0897	\N	\N	\N	\N	active	2026-03-29 17:32:32.670519	\N
12	Mark Mugisha	0772308559	\N	\N	\N	\N	active	2026-03-29 18:16:53.461254	\N
13	Supermarket	0899	\N	\N	\N	\N	active	2026-03-30 06:02:22.542293	\N
14	Saloon	0990	\N	\N	\N	\N	active	2026-03-30 06:45:37.444715	\N
15	Namara	07720000	\N	\N	\N	\N	active	2026-03-30 08:47:44.454334	\N
16	Rachel	0897000	\N	\N	\N	\N	active	2026-04-01 09:33:39.909607	\N

\.

COPY "units" FROM stdin;
1	1	1	\N	\N	\N	1500000.00	\N	occupied	{}	2026-03-19 09:56:38.084071
2	1	2	\N	\N	\N	400000.00	\N	occupied	{}	2026-03-24 09:54:15.140336
3	2	1	\N	\N	\N	750000.00	\N	occupied	{}	2026-03-29 09:14:03.733317
4	2	2	\N	\N	\N	400000.00	\N	occupied	{}	2026-03-29 10:53:34.634323
5	3	T-2	\N	\N	\N	800000.00	\N	occupied	{}	2026-03-29 11:03:43.60556
6	4	1	\N	\N	\N	1000000.00	\N	occupied	{}	2026-03-29 14:35:21.379966
7	4	2	\N	\N	\N	1200000.00	\N	occupied	{}	2026-03-29 14:35:34.852234
8	6	1	\N	\N	\N	2000000.00	\N	occupied	{}	2026-03-29 15:36:31.592136
9	7	A	\N	\N	\N	1000000.00	\N	occupied	{}	2026-03-29 16:08:08.144716
10	8	A	\N	\N	\N	700000.00	\N	occupied	{}	2026-03-29 17:03:50.386776
11	9	1	\N	\N	\N	3000000.00	\N	occupied	{}	2026-03-29 17:31:43.943249
12	10	L214	\N	\N	\N	1400000.00	\N	occupied	{}	2026-03-29 18:16:00.723904
13	11	1	\N	\N	\N	1000000.00	\N	occupied	{}	2026-03-30 06:01:37.825956
14	11	2	\N	\N	\N	500000.00	\N	occupied	{}	2026-03-30 06:44:39.988642
15	12	Uk-1	\N	\N	\N	1000000.00	\N	occupied	{}	2026-03-30 08:45:29.96121
16	12	Uk-2	\N	\N	\N	50000.00	\N	occupied	{}	2026-04-01 09:32:12.087768

\.

COPY "leases" FROM stdin;
1	1	1	2026-04-01	2099-12-31	1500000.00	UGX	\N	0.00	1	f	active	1	2026-03-19 09:57:42.998457
2	2	2	2026-01-01	2099-12-31	400000.00	UGX	\N	0.00	1	f	active	1	2026-03-24 09:55:14.11926
3	3	3	2026-03-01	2099-12-31	750000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 09:15:05.040334
4	4	4	2026-03-01	2099-12-31	400000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 10:54:31.634205
5	5	5	2026-03-01	2099-12-31	800000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 11:05:12.549933
6	6	6	2026-03-01	2099-12-31	1000000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 14:36:16.058972
7	7	7	2026-03-01	2099-12-31	1200000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 14:36:47.107785
8	8	8	2026-03-01	2099-12-31	2000000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 15:37:09.441963
9	9	9	2026-03-01	2099-12-31	1000000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 16:08:59.836107
10	10	10	2026-03-01	2099-12-31	700000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 17:04:29.774656
11	11	11	2026-03-01	2099-12-31	3000000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 17:32:32.732745
12	12	12	2026-03-01	2099-12-31	1400000.00	UGX	\N	0.00	1	f	active	1	2026-03-29 18:16:53.523387
13	13	13	2026-03-01	2099-12-31	1000000.00	UGX	\N	0.00	1	f	active	1	2026-03-30 06:02:22.603079
14	14	14	2026-03-01	2099-12-31	500000.00	UGX	\N	0.00	1	f	active	1	2026-03-30 06:45:37.50457
15	15	15	2026-03-01	2099-12-31	1000000.00	UGX	\N	0.00	1	f	active	1	2026-03-30 08:47:44.521152
16	16	16	2026-02-01	2099-12-31	50000.00	UGX	\N	0.00	1	f	active	1	2026-04-01 09:33:39.968486

\.

COPY "invoices" FROM stdin;
692	\N	5	3	5	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	200000.00	UGX	0.00	0.00	0.00	open	2026-03-29 11:55:13.982538	f	\N	\N
711	\N	5	3	5	2026-02-22	2026-02-22	2	2026	Arrears before lease date.	100000.00	UGX	0.00	0.00	0.00	open	2026-03-29 12:32:41.576444	f	\N	\N
730	\N	5	3	5	2026-02-02	2026-02-02	2	2026	Arrears before lease date.	15000.00	UGX	0.00	0.00	0.00	open	2026-03-29 13:11:52.544888	f	\N	\N
731	\N	4	2	4	2026-02-11	2026-02-11	2	2026	Arrears before lease date.	111000.00	UGX	0.00	0.00	0.00	open	2026-03-29 13:23:50.027675	f	\N	\N
744	\N	5	3	5	2026-02-01	2026-02-01	2	2026	Arrears before lease date.	92000.00	UGX	0.00	0.00	0.00	open	2026-03-29 13:45:17.181278	f	\N	\N
2596	3	3	2	3	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	750000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
757	\N	2	1	2	2025-12-31	2025-12-31	12	2025	Arrears before lease date.	50000.00	UGX	0.00	0.00	0.00	open	2026-03-29 14:06:49.443457	f	\N	\N
764	6	6	4	6	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-03-29 14:36:16.258307	f	\N	\N
4	1	1	1	1	2026-01-01	2026-01-01	1	2026	Rent for: January 2026	1500000.00	UGX	0.00	0.00	1500000.00	paid	2026-03-19 09:59:53.166095	f	\N	\N
765	7	7	4	7	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1200000.00	UGX	0.00	0.00	0.00	open	2026-03-29 14:36:47.292562	f	\N	\N
2	1	1	1	1	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1500000.00	UGX	0.00	0.00	0.00	open	2026-03-19 09:57:43.205838	t	2026-03-23 18:31:28.92686	1
8	\N	1	1	1	2025-12-10	2025-12-10	12	2025	Arrears before lease date. - Arrears in December 25	340000.00	UGX	0.00	0.00	340000.00	paid	2026-03-24 07:59:21.19894	f	\N	\N
896	\N	11	9	11	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	2000000.00	UGX	0.00	0.00	1500000.00	void	2026-03-29 17:33:35.025272	f	\N	\N
9	\N	1	1	1	2026-02-10	2026-02-10	2	2026	Arrears before lease date. - Feb arrears	99000.00	UGX	0.00	0.00	0.00	open	2026-03-24 08:05:56.674132	f	\N	\N
774	\N	6	4	6	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	400000.00	UGX	0.00	0.00	400000.00	open	2026-03-29 14:39:15.312022	f	\N	\N
11	2	2	1	2	2026-02-01	2026-02-01	2	2026	Rent for: February 2026	400000.00	UGX	0.00	0.00	0.00	open	2026-03-24 09:55:14.333919	f	\N	\N
12	2	2	1	2	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	400000.00	UGX	0.00	0.00	400000.00	paid	2026-03-24 09:55:14.333919	f	\N	\N
921	12	12	10	12	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1400000.00	UGX	0.00	0.00	0.00	open	2026-03-29 18:16:53.721022	f	\N	\N
7	\N	1	1	1	2025-12-31	2025-12-31	12	2025	Arrears before lease date. - Arrears before Jan 26	400000.00	UGX	0.00	0.00	400000.00	paid	2026-03-24 07:25:14.249062	f	\N	\N
807	\N	7	4	7	2026-02-25	2026-02-25	2	2026	Arrears before lease date.	750000.00	UGX	0.00	0.00	150000.00	void	2026-03-29 15:28:32.16538	f	\N	\N
808	8	8	6	8	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	2000000.00	UGX	0.00	0.00	0.00	open	2026-03-29 15:37:09.629599	f	\N	\N
10	2	2	1	2	2026-01-01	2026-01-01	1	2026	Rent for: January 2026	400000.00	UGX	0.00	0.00	240000.00	open	2026-03-24 09:55:14.333919	f	\N	\N
13	\N	2	1	2	2025-12-10	2025-12-10	12	2025	Arrears before lease date. - Oct-Dec 25 Arrears	1000000.00	UGX	0.00	0.00	1000000.00	paid	2026-03-24 09:57:25.052751	f	\N	\N
1	1	1	1	1	2026-02-01	2026-02-01	2	2026	Rent for: February 2026	1500000.00	UGX	0.00	0.00	1205000.00	open	2026-03-19 09:57:43.205838	f	\N	\N
818	\N	8	6	8	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	1000000.00	UGX	0.00	0.00	700000.00	void	2026-03-29 15:37:55.809394	f	\N	\N
1146	\N	15	12	15	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	800000.00	UGX	0.00	0.00	400000.00	void	2026-03-30 08:49:58.509264	f	\N	\N
621	\N	3	2	3	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	500000.00	UGX	0.00	0.00	500000.00	paid	2026-03-29 09:18:02.492104	f	\N	\N
659	4	4	2	4	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	400000.00	UGX	0.00	0.00	0.00	open	2026-03-29 10:54:31.814121	f	\N	\N
660	\N	4	2	4	2026-02-26	2026-02-26	2	2026	Arrears before lease date.	300000.00	UGX	0.00	0.00	200000.00	open	2026-03-29 10:55:39.04335	f	\N	\N
666	5	5	3	5	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	800000.00	UGX	0.00	0.00	0.00	open	2026-03-29 11:05:12.743571	f	\N	\N
922	\N	12	10	12	2026-03-29	2026-03-29	3	2026	Arrears before lease date.	1000000.00	UGX	0.00	0.00	600000.00	void	2026-03-29 18:17:48.960591	f	\N	\N
828	\N	8	6	8	2026-02-27	2026-02-27	2	2026	Arrears before lease date.	900000.00	UGX	0.00	0.00	450000.00	void	2026-03-29 15:58:01.13276	f	\N	\N
838	9	9	7	9	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-03-29 16:09:00.023023	f	\N	\N
962	13	13	11	13	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-03-30 06:02:22.785569	f	\N	\N
849	\N	9	7	9	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	500000.00	UGX	0.00	0.00	400000.00	void	2026-03-29 16:12:49.15561	f	\N	\N
882	\N	10	8	10	2026-03-29	2026-03-29	3	2026	Arrears before lease date.	200000.00	UGX	0.00	0.00	0.00	open	2026-03-29 17:06:46.02816	t	2026-03-29 17:09:21.00549	1
883	\N	10	8	10	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	500000.00	UGX	0.00	0.00	200000.00	void	2026-03-29 17:10:21.644896	f	\N	\N
895	11	11	9	11	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	3000000.00	UGX	0.00	0.00	0.00	open	2026-03-29 17:32:32.929279	f	\N	\N
620	3	3	2	3	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	750000.00	UGX	0.00	0.00	750000.00	paid	2026-03-29 09:15:05.224514	f	\N	\N
963	\N	13	11	13	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	600000.00	UGX	0.00	0.00	480000.00	void	2026-03-30 06:03:44.305553	f	\N	\N
992	14	14	11	14	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	500000.00	UGX	0.00	0.00	0.00	open	2026-03-30 06:45:37.700618	f	\N	\N
993	\N	14	11	14	2026-02-28	2026-02-28	2	2026	Arrears before lease date.	400000.00	UGX	0.00	0.00	300000.00	void	2026-03-30 06:46:37.27438	f	\N	\N
1129	15	15	12	15	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-03-30 08:47:44.739305	f	\N	\N
2590	1	1	1	1	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1500000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2594	2	2	1	2	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	400000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2598	4	4	2	4	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	400000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2600	5	5	3	5	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	800000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2602	6	6	4	6	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2604	7	7	4	7	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1200000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2606	8	8	6	8	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	2000000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2608	9	9	7	9	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2612	11	11	9	11	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	3000000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2614	12	12	10	12	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1400000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2610	10	10	8	10	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	700000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	t	2026-04-01 09:18:13.352813	1
2269	10	10	8	10	2026-02-28	2026-02-28	2	2026	Manual invoice testing	321000.00	UGX	0.00	0.00	0.00	open	2026-03-31 14:49:15.668376	t	2026-04-01 09:18:30.139085	1
667	\N	5	3	5	2026-02-20	2026-02-20	2	2026	Arrears before lease date.	700000.00	UGX	0.00	0.00	700000.00	paid	2026-03-29 11:06:41.123197	f	\N	\N
2616	13	13	11	13	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2618	14	14	11	14	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	500000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
2620	15	15	12	15	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	1000000.00	UGX	0.00	0.00	0.00	open	2026-04-01 06:11:40.075041	f	\N	\N
870	10	10	8	10	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	700000.00	UGX	0.00	0.00	0.00	open	2026-03-29 17:04:29.960653	t	2026-04-01 09:17:58.071106	1
6899	10	10	8	10	2026-02-28	2026-02-28	2	2026	Adjusting Invoice for 20th - 28th Feb 26.	43000.00	UGX	0.00	0.00	0.00	open	2026-04-01 08:29:20.884359	t	2026-04-01 09:18:50.255039	1
7708	16	16	12	16	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	50000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:33:40.151711	f	\N	\N
7709	16	16	12	16	2026-01-30	2026-01-30	1	2026	Adjusting entry	30000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:34:54.698505	f	\N	\N
7706	16	16	12	16	2026-02-01	2026-02-01	2	2026	Rent for: February 2026	50000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:33:40.151711	t	2026-04-01 09:35:34.471214	1
7707	16	16	12	16	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	50000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:33:40.151711	t	2026-04-01 09:35:46.060169	1
7741	16	16	12	16	2026-02-01	2026-02-01	2	2026	Rent for: February 2026	50000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:39:11.763927	t	2026-04-01 09:57:40.261551	1
7742	16	16	12	16	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	50000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:39:11.763927	t	2026-04-01 09:57:50.279674	1
7774	16	16	12	16	2026-03-31	2026-03-31	3	2026	Second adjusting entry for testing	20000.00	UGX	0.00	0.00	0.00	open	2026-04-01 09:59:53.897669	f	\N	\N
2251	10	10	8	10	2026-02-20	2026-02-20	2	2026	Rent 20th-28th Feb	250000.00	UGX	0.00	0.00	250000.00	paid	2026-03-31 14:22:48.52777	f	\N	\N
7695	10	10	8	10	2026-04-01	2026-04-01	4	2026	Rent for: April 2026	700000.00	UGX	0.00	0.00	700000.00	paid	2026-04-01 09:28:48.437722	f	\N	\N
7694	10	10	8	10	2026-03-01	2026-03-01	3	2026	Rent for: March 2026	700000.00	UGX	0.00	0.00	450000.00	open	2026-04-01 09:28:48.437722	f	\N	\N

\.

COPY "landlord_deductions" FROM stdin;
2	2	2	2026-03-29	Fees on recovered arrears - February 2026	20000.00	1	2026-03-29 10:56:31.154527	f	\N	\N
3	3	3	2026-03-29	Fees on recovered arrears - February 2026	60000.00	1	2026-03-29 11:07:58.134845	f	\N	\N
4	3	3	2026-03-29	Fees on recovered arrears - February 2026	10000.00	1	2026-03-29 11:24:52.684571	f	\N	\N
5	4	4	2026-03-29	Fees on recovered arrears - February 2026	40000.00	1	2026-03-29 14:40:57.651289	f	\N	\N
6	4	4	2026-03-29	Fees on recovered arrears - February 2026	15000.00	1	2026-03-29 15:30:33.308986	f	\N	\N
7	5	6	2026-03-29	Fees on recovered arrears - February 2026	70000.00	1	2026-03-29 15:44:25.358992	f	\N	\N
8	5	6	2026-03-29	Fees on recovered arrears - February 2026	45000.00	1	2026-03-29 15:58:50.908454	f	\N	\N
9	6	7	2026-03-29	Fees on recovered arrears - February 2026	40000.00	1	2026-03-29 16:15:19.425075	f	\N	\N
10	7	8	2026-03-29	Fees on recovered arrears - February 2026	20000.00	1	2026-03-29 17:11:41.436918	f	\N	\N
11	8	9	2026-03-29	Fees on recovered arrears - February 2026	150000.00	1	2026-03-29 17:35:26.234208	f	\N	\N
12	9	10	2026-03-29	Fees on recovered arrears - March 2026	60000.00	1	2026-03-29 18:19:09.715539	f	\N	\N
13	10	11	2026-03-30	Fees on recovered arrears - February 2026	48000.00	1	2026-03-30 06:04:54.263178	f	\N	\N
14	10	11	2026-03-30	Fees on recovered arrears - February 2026	30000.00	1	2026-03-30 06:48:05.826238	f	\N	\N

\.

COPY "landlords" FROM stdin;
1	Mark	0567	\N	2026-03-19 09:55:37.578201	\N	2000-01-12	active	2026-01-01	\N	mobile_money	\N	\N	\N	Mark	0772308559
2	Duncan Paddy	0784999999	\N	2026-03-29 08:42:56.819908	\N	2000-01-10	active	2025-12-01	\N	bank	Centenary	Duncan Paddy	32021367888	\N	\N
3	Traitor	0772000000	\N	2026-03-29 11:02:20.342996	\N	2000-01-15	active	2026-03-01	\N	bank	Cente	Traitor	03246759	\N	\N
4	Blessed Blessing	087400000	\N	2026-03-29 14:34:06.653185	\N	2000-01-20	active	2025-12-01	2027-02-28	mobile_money	\N	\N	\N	Blessing	0757000111
5	Reverse Tester	078900	\N	2026-03-29 15:35:15.724625	\N	2000-01-15	active	2026-01-01	\N	mobile_money	\N	\N	\N	Tester	07896990
6	Divine	0766000	\N	2026-03-29 16:06:30.375171	\N	2000-01-21	active	2026-03-01	\N	bank	Cente	Divine	089765	\N	\N
7	New	098	\N	2026-03-29 17:02:38.946894	\N	2000-01-16	active	2026-01-01	\N	mobile_money	\N	\N	\N	new	0978
8	Hajii	0899	\N	2026-03-29 17:30:32.775511	\N	2000-01-22	active	2026-01-01	\N	mobile_money	\N	\N	\N	Hajji	0789
9	Umar	078990	\N	2026-03-29 18:14:28.084569	\N	\N	active	2026-01-01	\N	mobile_money	\N	\N	\N	umar	4567
10	Businessman	07745	\N	2026-03-30 06:00:53.308283	\N	2000-01-12	active	2025-12-01	\N	mobile_money	\N	\N	\N	Biz	0987

\.

COPY "landlord_payouts" FROM stdin;
1	2	2	2026-03-29	900000.00	Bank Account - Operating	\N	\N	1	2026-03-29 10:16:02.998641	f	\N	\N
3	4	4	2026-03-29	2340000.00	Bank Account - Operating	\N	\N	1	2026-03-29 14:45:08.008367	f	\N	\N
4	6	7	2026-04-01	100000.00	Bank Account - Operating	\N	\N	1	2026-04-01 11:16:11.785389	f	\N	\N
5	4	4	2026-03-01	1145000.00	Cash on Hand	\N	\N	1	2026-04-01 11:20:00.79191	f	\N	\N
6	8	12	2026-03-17	500000.00	Cash on Hand	\N	\N	1	2026-04-01 11:28:33.09598	f	\N	\N
7	10	11	2026-03-31	402000.00	Bank Account - Operating	\N	\N	1	2026-04-02 10:22:44.187498	f	\N	\N
8	6	7	2026-03-31	450000.00	Cash on Hand	Payment to Divine	\N	1	2026-04-02 13:08:34.774024	t	2026-04-02 13:23:00.854848	1
2	3	3	2026-03-29	1260000.00	Bank Account - Operating	\N	\N	1	2026-03-29 11:23:11.214473	t	2026-04-02 15:21:06.842403	1
9	7	8	2026-03-31	1165000.00	Cash on Hand	\N	\N	1	2026-04-02 15:56:54.394417	f	\N	\N

\.

COPY "payment_invoice_allocations" FROM stdin;
1	1	4	100000.00	2026-03-23 16:22:44.111221
2	2	4	100000.00	2026-03-23 16:22:44.228028
3	4	4	1200000.00	2026-03-23 16:22:44.231038
4	4	1	800000.00	2026-03-23 16:22:44.237128
5	3	4	100000.00	2026-03-23 16:22:44.251593
6	5	7	245000.00	2026-03-24 07:28:39.03388
7	6	8	340000.00	2026-03-24 08:01:44.436785
8	6	7	100000.00	2026-03-24 08:01:44.573866
10	7	1	15000.00	2026-03-24 08:06:43.051443
11	8	12	400000.00	2026-03-24 09:58:33.250221
12	9	13	200000.00	2026-03-24 10:05:02.22209
9	7	7	55000.00	2026-03-24 08:06:42.915308
13	10	13	300000.00	2026-03-25 06:29:54.743671
14	11	13	157000.00	2026-03-25 06:39:35.111085
15	12	13	3000.00	2026-03-25 06:42:51.399021
16	13	10	240000.00	2026-03-25 06:43:41.354662
17	14	13	110000.00	2026-03-25 06:51:14.245675
18	15	13	230000.00	2026-03-25 07:04:28.711646
19	16	1	390000.00	2026-03-25 07:05:18.570657
21	18	621	250000.00	2026-03-29 09:37:04.222024
22	19	621	250000.00	2026-03-29 10:18:55.561284
23	20	660	200000.00	2026-03-29 10:56:30.436249
24	21	667	600000.00	2026-03-29 11:07:55.685309
26	23	774	400000.00	2026-03-29 14:40:55.189085
27	24	807	150000.00	2026-03-29 15:30:30.888455
28	25	818	700000.00	2026-03-29 15:44:22.901797
29	26	828	450000.00	2026-03-29 15:58:50.173399
30	27	849	400000.00	2026-03-29 16:15:16.935879
31	28	883	200000.00	2026-03-29 17:11:39.075322
32	29	896	1500000.00	2026-03-29 17:35:23.759084
33	30	922	600000.00	2026-03-29 18:19:08.995042
34	31	963	480000.00	2026-03-30 06:04:51.835698
35	32	993	300000.00	2026-03-30 06:48:03.41683
36	33	1146	400000.00	2026-03-30 08:51:07.703111
37	34	620	750000.00	2026-03-31 13:44:26.127665
39	35	7694	450000.00	2026-04-02 07:20:08.56746
40	36	7694	100000.00	2026-04-06 11:47:43.756708
38	35	2251	250000.00	2026-04-02 07:20:08.453483
25	22	667	100000.00	2026-03-29 11:24:50.260098
42	37	7695	700000.00	2026-04-06 13:53:13.425438
41	37	7694	600000.00	2026-04-06 13:53:13.301207

\.

COPY "user_roles" FROM stdin;
1	Admin	{"reports": true, "tenants": true, "payments": true, "dashboard": true, "accounting": true, "properties": true, "maintenance": true}	2026-03-17 12:12:35.078074

\.

COPY "payments" FROM stdin;
1	1	1	1	2026-03-23	100000.00	UGX	MTN MoMo	1234	\N	\N	1	\N	f	\N	\N	2026-03-23 16:20:29.597473	\N	\N	\N	Payment on Account
2	1	1	1	2026-03-23	100000.00	UGX	MTN MoMo	1234	\N	\N	1	\N	f	\N	\N	2026-03-23 16:20:40.321036	\N	\N	\N	Payment on Account
3	1	1	1	2026-03-23	100000.00	UGX	MTN MoMo	1234	\N	\N	1	\N	f	\N	\N	2026-03-23 16:21:06.662367	\N	\N	\N	Payment on Account
4	1	1	1	2026-03-23	2000000.00	UGX	MTN MoMo	\N	\N	\N	1	\N	f	\N	\N	2026-03-23 16:22:41.580469	\N	\N	\N	Payment on Account
5	1	1	1	2026-03-24	245000.00	UGX	MTN MoMo	234	\N	\N	1	\N	f	\N	\N	2026-03-24 07:28:36.099549	\N	\N	\N	Payment on Account
6	1	1	1	2026-03-24	440000.00	UGX	MTN MoMo	234	\N	\N	1	\N	f	\N	\N	2026-03-24 08:01:41.465558	\N	\N	\N	Payment on Account
8	2	2	1	2026-03-24	400000.00	UGX	MTN MoMo	456	\N	\N	1	\N	f	\N	\N	2026-03-24 09:58:33.180038	\N	\N	\N	Rent for: March 2026
9	2	2	1	2026-03-24	200000.00	UGX	MTN MoMo	678	\N	\N	1	\N	f	\N	\N	2026-03-24 10:04:59.194594	\N	\N	\N	Payment on Account
7	1	1	1	2026-03-24	55000.00	UGX	MTN MoMo	123	\N	\N	1	Has it worked	f	\N	\N	2026-03-24 08:06:41.944765	\N	\N	\N	Payment on Account
10	\N	2	1	2026-03-25	300000.00	UGX	MTN MoMo	123	\N	\N	1	Partial on Oct-Dec arrears	f	\N	\N	2026-03-25 06:29:54.63718	\N	\N	\N	Arrears before lease date. - Oct-Dec 25 Arrears
11	\N	2	1	2026-03-25	157000.00	UGX	MTN MoMo	789	\N	\N	1	Partial	f	\N	\N	2026-03-25 06:39:35.049338	\N	\N	\N	Arrears before lease date. - Oct-Dec 25 Arrears
12	2	2	1	2026-03-25	3000.00	UGX	MTN MoMo	987	\N	\N	1	Partial	f	\N	\N	2026-03-25 06:42:48.790015	\N	\N	\N	Payment on Account
13	2	2	1	2026-03-25	240000.00	UGX	MTN MoMo	\N	\N	\N	1	\N	f	\N	\N	2026-03-25 06:43:41.295847	\N	\N	\N	Rent for: January 2026
14	2	2	1	2026-03-25	110000.00	UGX	MTN MoMo	900	\N	\N	1	\N	f	\N	\N	2026-03-25 06:51:11.678506	\N	\N	\N	Payment on Account
15	\N	2	1	2026-03-25	230000.00	UGX	MTN MoMo	549	\N	\N	1	\N	f	\N	\N	2026-03-25 07:04:28.644247	\N	\N	\N	Arrears before lease date. - Oct-Dec 25 Arrears
16	1	1	1	2026-03-25	390000.00	UGX	MTN MoMo	901	\N	\N	1	\N	f	\N	\N	2026-03-25 07:05:17.743313	\N	\N	\N	Payment on Account
17	3	3	2	2026-03-29	230000.00	UGX	MTN MoMo	123	\N	\N	1	\N	t	1	2026-03-29 09:31:12.885958	2026-03-29 09:20:29.816704	\N	\N	\N	Payment on Account
18	\N	3	2	2026-03-29	250000.00	UGX	MTN MoMo	342	\N	\N	1	\N	f	\N	\N	2026-03-29 09:37:04.159754	\N	\N	\N	Arrears before lease date.
19	\N	3	2	2026-03-29	250000.00	UGX	MTN MoMo	546	\N	\N	1	\N	f	\N	\N	2026-03-29 10:18:55.499169	\N	\N	\N	Arrears before lease date.
20	\N	4	2	2026-03-29	200000.00	UGX	MTN MoMo	908	\N	\N	1	\N	f	\N	\N	2026-03-29 10:56:30.372267	\N	\N	\N	Arrears before lease date.
21	\N	5	3	2026-03-29	600000.00	UGX	MTN MoMo	897	\N	\N	1	\N	f	\N	\N	2026-03-29 11:07:55.623793	\N	\N	\N	Arrears before lease date.
23	\N	6	4	2026-03-29	400000.00	UGX	MTN MoMo	34	\N	\N	1	\N	f	\N	\N	2026-03-29 14:40:55.125405	\N	\N	\N	Arrears before lease date.
24	\N	7	4	2026-03-29	150000.00	UGX	MTN MoMo	456	\N	\N	1	\N	f	\N	\N	2026-03-29 15:30:30.82809	\N	\N	\N	Arrears before lease date.
25	\N	8	6	2026-03-29	700000.00	UGX	MTN MoMo	870	\N	\N	1	\N	f	\N	\N	2026-03-29 15:44:22.839291	\N	\N	\N	Arrears before lease date.
26	\N	8	6	2026-03-29	450000.00	UGX	MTN MoMo	345	\N	\N	1	\N	f	\N	\N	2026-03-29 15:58:50.111862	\N	\N	\N	Arrears before lease date.
27	\N	9	7	2026-03-29	400000.00	UGX	MTN MoMo	432	\N	\N	1	\N	f	\N	\N	2026-03-29 16:15:16.868651	\N	\N	\N	Arrears before lease date.
28	\N	10	8	2026-03-29	200000.00	UGX	MTN MoMo	\N	\N	\N	1	\N	f	\N	\N	2026-03-29 17:11:39.013706	\N	\N	\N	Arrears before lease date.
29	\N	11	9	2026-03-29	1500000.00	UGX	MTN MoMo	234	\N	\N	1	\N	f	\N	\N	2026-03-29 17:35:23.696739	\N	\N	\N	Arrears before lease date.
30	\N	12	10	2026-03-29	600000.00	UGX	MTN MoMo	231	\N	\N	1	\N	f	\N	\N	2026-03-29 18:19:08.933562	\N	\N	\N	Arrears before lease date.
31	\N	13	11	2026-03-30	480000.00	UGX	MTN MoMo	099	\N	\N	1	\N	f	\N	\N	2026-03-30 06:04:51.774726	\N	\N	\N	Arrears before lease date.
32	\N	14	11	2026-03-30	300000.00	UGX	MTN MoMo	123	\N	\N	1	\N	f	\N	\N	2026-03-30 06:48:03.356385	\N	\N	\N	Arrears before lease date.
33	15	15	12	2026-03-30	400000.00	UGX	MTN MoMo	908	\N	\N	1	\N	f	\N	\N	2026-03-30 08:51:05.130516	\N	\N	\N	Payment on Account
34	3	3	2	2026-03-31	750000.00	UGX	MTN MoMo	89	\N	\N	1	\N	f	\N	\N	2026-03-31 13:44:23.466836	\N	\N	\N	Payment on Account
36	10	10	8	2026-04-06	100000.00	UGX	MTN MoMo	456	\N	\N	1	\N	f	\N	\N	2026-04-06 11:47:43.688374	\N	\N	\N	Rent for: March 2026
35	10	10	8	2026-04-02	250000.00	UGX	MTN MoMo	567	\N	\N	1	\N	f	\N	\N	2026-04-02 07:20:05.865941	\N	\N	\N	Payment on Account
22	\N	5	3	2026-03-29	100000.00	UGX	MTN MoMo	123	\N	\N	1	\N	f	\N	\N	2026-03-29 11:24:50.199128	\N	\N	\N	Arrears before lease date.
37	10	10	8	2026-04-06	600000.00	UGX	MTN MoMo	452	\N	\N	1	\N	f	\N	\N	2026-04-06 13:53:10.85608	\N	\N	\N	Payment on Account

\.

COPY "transactions" FROM stdin;
10	2026-03-29	Payment on Account - Magufuli - Tester	\N	2	3	2000000.00	UGX	1	2026-03-29 09:42:18.644764	\N	\N	\N	deposit	\N	f	\N	\N	\N
1	2026-03-23	Payment on Account - Magufuli - Tester	\N	3	8	2000000.00	UGX	1	2026-03-23 16:22:43.680439	\N	1	1	payment_advance	4	f	\N	\N	10
11	2026-03-29	Landlord payout - Bank Account - Operating	\N	7	2	900000.00	UGX	1	2026-03-29 10:16:03.468676	\N	2	2	landlord_payout	1	f	\N	\N	\N
14	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	20000.00	UGX	1	2026-03-29 10:56:31.501537	landlord	2	2	landlord_deduction	2	f	\N	\N	\N
16	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	60000.00	UGX	1	2026-03-29 11:07:58.490526	landlord	3	3	landlord_deduction	3	f	\N	\N	\N
17	2026-03-29	Rent collection - Multiple tenants - Multiple periods	\N	2	3	1373000.00	UGX	1	2026-03-29 11:22:19.797361	\N	\N	\N	deposit	\N	f	\N	\N	\N
2	2026-03-24	Payment on Account - Magufuli - Tester	234	3	8	440000.00	UGX	1	2026-03-24 07:28:38.552108	\N	1	1	payment_advance	6	f	\N	\N	17
4	2026-03-24	Payment on Account - Rwatamagufa Kachope - Tester	678	3	8	200000.00	UGX	1	2026-03-24 10:05:01.737502	\N	1	1	payment_advance	9	f	\N	\N	17
5	2026-03-25	Payment on Account - Rwatamagufa Kachope - Tester	987	3	8	3000.00	UGX	1	2026-03-25 06:42:51.090264	\N	1	1	payment_advance	12	f	\N	\N	17
6	2026-03-25	Payment on Account - Rwatamagufa Kachope - Tester	900	3	8	110000.00	UGX	1	2026-03-25 06:51:13.829046	\N	1	1	payment_advance	14	f	\N	\N	17
7	2026-03-25	Rent Collection - Rwatamagufa Kachope - Arrears before lease date. - Oct-Dec 25 Arrears	549	3	4	230000.00	UGX	1	2026-03-25 07:04:31.037848	\N	1	1	payment	15	f	\N	\N	17
8	2026-03-25	Payment on Account - Magufuli - Tester	901	3	8	390000.00	UGX	1	2026-03-25 07:05:18.152541	\N	1	1	payment_advance	16	f	\N	\N	17
20	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	10000.00	UGX	1	2026-03-29 11:24:53.039381	landlord	3	3	landlord_deduction	4	f	\N	\N	\N
21	2026-03-29	Rent invoice reversal - Rent accrual reversal	\N	7	4	200000.00	UGX	1	2026-03-29 12:20:44.718609	\N	\N	\N	rent_reversal	\N	f	\N	\N	\N
22	2026-03-29	Rent invoice reversal - Management fee reversal	\N	14	7	20000.00	UGX	1	2026-03-29 12:20:45.133379	\N	\N	\N	mgmt_fee_reversal	\N	f	\N	\N	\N
23	2026-03-29	Invoice reversal - Rent accrual reversal	\N	7	4	100000.00	UGX	1	2026-03-29 12:34:35.430451	\N	\N	\N	rent_reversal	\N	f	\N	\N	\N
24	2026-03-29	Invoice reversal - Management fee reversal	\N	14	7	10000.00	UGX	1	2026-03-29 12:34:35.84683	\N	\N	\N	mgmt_fee_reversal	\N	f	\N	\N	\N
25	2026-03-29	Rent invoice reversal - Rent accrual reversal	\N	7	4	100000.00	UGX	1	2026-03-29 12:40:28.349153	\N	\N	\N	rent_reversal	\N	f	\N	\N	\N
26	2026-03-29	Rent invoice reversal - Management fee reversal	\N	14	7	10000.00	UGX	1	2026-03-29 12:40:28.762749	\N	\N	\N	mgmt_fee_reversal	\N	f	\N	\N	\N
27	2026-03-29	Rent invoice reversal - Rent accrual reversal	\N	7	4	15000.00	UGX	1	2026-03-29 13:12:26.949562	\N	\N	3	rent_reversal	\N	f	\N	\N	\N
28	2026-03-29	Rent invoice reversal - Management fee reversal	\N	14	7	1500.00	UGX	1	2026-03-29 13:12:27.413346	\N	\N	3	mgmt_fee_reversal	\N	f	\N	\N	\N
29	2026-03-29	Rent invoice reversal - Rent accrual reversal	\N	7	4	111000.00	UGX	1	2026-03-29 13:24:20.612326	\N	\N	2	rent_reversal	\N	f	\N	\N	\N
30	2026-03-29	Rent invoice reversal - Management fee reversal	\N	14	7	11100.00	UGX	1	2026-03-29 13:24:21.022175	\N	\N	2	mgmt_fee_reversal	\N	f	\N	\N	\N
31	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	111000.00	UGX	1	2026-03-29 13:43:33.377568	\N	\N	2	rent_reversal	731	f	\N	\N	\N
32	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	11100.00	UGX	1	2026-03-29 13:43:33.80554	\N	\N	2	mgmt_fee_reversal	731	f	\N	\N	\N
33	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	92000.00	UGX	1	2026-03-29 13:51:08.137489	\N	\N	3	rent_reversal	744	f	\N	\N	\N
34	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	9200.00	UGX	1	2026-03-29 13:51:08.559888	\N	\N	3	mgmt_fee_reversal	744	f	\N	\N	\N
35	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	33999.99	UGX	1	2026-03-29 14:07:30.203913	\N	\N	1	rent_reversal	757	f	\N	\N	\N
36	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	300000.00	UGX	1	2026-03-29 14:07:30.618864	\N	\N	1	mgmt_fee_reversal	757	f	\N	\N	\N
37	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	134000.00	UGX	1	2026-03-29 14:18:09.599268	\N	\N	1	rent_reversal	757	f	\N	\N	\N
38	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	171794.87	UGX	1	2026-03-29 14:18:10.046483	\N	\N	1	mgmt_fee_reversal	757	f	\N	\N	\N
39	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	134000.00	UGX	1	2026-03-29 14:23:31.250575	\N	\N	1	rent_reversal	757	f	\N	\N	\N
40	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	171794.87	UGX	1	2026-03-29 14:23:31.683126	\N	\N	1	mgmt_fee_reversal	757	f	\N	\N	\N
41	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	50000.00	UGX	1	2026-03-29 14:26:17.376678	\N	\N	1	rent_reversal	757	f	\N	\N	\N
42	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	150000.00	UGX	1	2026-03-29 14:26:17.788237	\N	\N	1	mgmt_fee_reversal	757	f	\N	\N	\N
44	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	40000.00	UGX	1	2026-03-29 14:40:58.004699	landlord	4	4	landlord_deduction	5	f	\N	\N	\N
48	2026-03-29	Rent invoice reversal - Management fee reversal - Arrears before lease date.	\N	14	7	20000.00	UGX	1	2026-03-29 14:46:33.755241	\N	\N	4	mgmt_fee_reversal	774	f	\N	\N	\N
45	2026-03-29	Rent collection - Multiple tenants - Multiple periods	\N	2	3	2030000.00	UGX	1	2026-03-29 14:44:12.386335	\N	\N	\N	deposit	\N	t	2026-04-02 15:20:41.754608	1	\N
18	2026-03-29	Landlord payout - Bank Account - Operating	\N	7	2	1260000.00	UGX	1	2026-03-29 11:23:11.677492	\N	3	3	landlord_payout	2	t	2026-04-02 15:21:06.901951	1	\N
55	2026-03-29	Rent Collection - Beloved - Arrears before lease date.	345	3	4	450000.00	UGX	1	2026-03-29 15:58:50.723638	\N	5	6	payment	26	f	\N	\N	89
58	2026-03-29	Rent Collection - Eliezer - Arrears before lease date.	432	3	4	400000.00	UGX	1	2026-03-29 16:15:19.243328	\N	6	7	payment	27	f	\N	\N	89
61	2026-03-29	Rent Collection - Sweep - Arrears before lease date.	\N	3	4	200000.00	UGX	1	2026-03-29 17:11:41.255785	\N	7	8	payment	28	f	\N	\N	89
46	2026-03-29	Landlord payout - Bank Account - Operating	\N	7	2	2340000.00	UGX	1	2026-03-29 14:45:08.4747	\N	4	4	landlord_payout	3	f	\N	\N	\N
47	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	200000.00	UGX	1	2026-03-29 14:46:33.338579	\N	\N	4	rent_reversal	774	f	\N	\N	\N
50	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	15000.00	UGX	1	2026-03-29 15:30:33.65767	landlord	4	4	landlord_deduction	6	f	\N	\N	\N
51	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	600000.00	UGX	1	2026-03-29 15:32:44.771703	\N	\N	4	rent_reversal	807	f	\N	\N	\N
53	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	70000.00	UGX	1	2026-03-29 15:44:25.706639	landlord	5	6	landlord_deduction	7	f	\N	\N	\N
54	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	300000.00	UGX	1	2026-03-29 15:45:44.088223	\N	\N	6	rent_reversal	818	f	\N	\N	\N
56	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	45000.00	UGX	1	2026-03-29 15:58:51.260293	landlord	5	6	landlord_deduction	8	f	\N	\N	\N
57	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	450000.00	UGX	1	2026-03-29 16:04:27.567804	\N	\N	6	rent_reversal	828	f	\N	\N	\N
59	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	40000.00	UGX	1	2026-03-29 16:15:19.911796	landlord	6	7	landlord_deduction	9	f	\N	\N	\N
60	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	100000.00	UGX	1	2026-03-29 16:18:00.275713	\N	\N	7	rent_reversal	849	f	\N	\N	\N
62	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	20000.00	UGX	1	2026-03-29 17:11:41.785461	landlord	7	8	landlord_deduction	10	f	\N	\N	\N
63	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	300000.00	UGX	1	2026-03-29 17:15:45.620724	\N	\N	8	rent_reversal	883	f	\N	\N	\N
65	2026-03-29	Management fees on recovered arrears - February 2026	\N	7	14	150000.00	UGX	1	2026-03-29 17:35:26.592674	landlord	8	9	landlord_deduction	11	f	\N	\N	\N
66	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	500000.00	UGX	1	2026-03-29 17:40:39.940974	\N	\N	9	rent_reversal	896	f	\N	\N	\N
67	2026-03-29	Management fee reversal - Arrears before lease date.	\N	14	7	50000.00	UGX	1	2026-03-29 17:40:40.379065	\N	\N	9	mgmt_fee_reversal	896	f	\N	\N	\N
69	2026-03-29	Management fees on recovered arrears - March 2026	\N	7	14	60000.00	UGX	1	2026-03-29 18:19:10.079837	landlord	9	10	landlord_deduction	12	f	\N	\N	\N
70	2026-03-29	Rent invoice reversal - Arrears before lease date.	\N	7	4	400000.00	UGX	1	2026-03-29 18:19:56.393507	\N	\N	10	rent_reversal	922	f	\N	\N	\N
71	2026-03-29	Management fee reversal - Arrears before lease date.	\N	14	7	40000.00	UGX	1	2026-03-29 18:19:56.810617	\N	\N	10	mgmt_fee_reversal	922	f	\N	\N	\N
73	2026-03-30	Management fees on recovered arrears - February 2026	\N	7	14	48000.00	UGX	1	2026-03-30 06:04:54.614345	landlord	10	11	landlord_deduction	13	f	\N	\N	\N
74	2026-03-30	Rent invoice reversal - Arrears before lease date.	\N	7	4	120000.00	UGX	1	2026-03-30 06:06:40.484568	\N	\N	11	rent_reversal	963	f	\N	\N	\N
76	2026-03-30	Management fees on recovered arrears - February 2026	\N	7	14	30000.00	UGX	1	2026-03-30 06:48:06.196527	landlord	10	11	landlord_deduction	14	f	\N	\N	\N
77	2026-03-30	Rent invoice reversal - Arrears before lease date.	\N	7	4	100000.00	UGX	1	2026-03-30 07:00:19.994205	\N	\N	11	rent_reversal	993	f	\N	\N	\N
79	2026-03-30	Rent invoice reversal - Arrears before lease date.	\N	7	4	400000.00	UGX	1	2026-03-30 08:53:19.04085	\N	\N	12	rent_reversal	1146	f	\N	\N	\N
81	2026-04-01	Landlord payout - Bank Account - Operating	\N	7	2	100000.00	UGX	1	2026-04-01 11:16:12.253066	\N	6	7	landlord_payout	4	f	\N	\N	\N
83	2026-03-01	Landlord payout - Cash on Hand	\N	7	1	1145000.00	UGX	1	2026-04-01 11:20:01.278716	\N	4	4	landlord_payout	5	f	\N	\N	\N
84	2026-03-17	Landlord payout - Cash on Hand	\N	7	1	500000.00	UGX	1	2026-04-01 11:28:33.562683	\N	8	12	landlord_payout	6	f	\N	\N	\N
86	2026-03-31	Landlord payout - Bank Account - Operating	\N	7	2	402000.00	UGX	1	2026-04-02 10:22:44.714235	\N	10	11	landlord_payout	7	f	\N	\N	\N
88	2026-04-02	Cash withdrawal	TRANSFER-1775137931238	1	2	1000.00	UGX	1	2026-04-02 13:52:11.271041	\N	\N	\N	manual	\N	f	\N	\N	\N
87	2026-03-31	Landlord payout - Divine	Payment to Divine	7	1	450000.00	UGX	1	2026-04-02 13:08:35.366026	\N	6	7	landlord_payout	8	t	2026-04-02 13:23:00.913431	1	\N
82	2026-04-01	Rent collection - Multiple tenants - Multiple periods	\N	1	3	3400000.00	UGX	1	2026-04-01 11:18:12.026867	\N	\N	\N	deposit	\N	t	2026-04-02 14:18:59.063575	1	\N
89	2026-04-02	Rent collection - Multiple tenants - Multiple periods	\N	1	3	8660000.00	UGX	1	2026-04-02 15:56:11.849546	\N	\N	\N	deposit	\N	f	\N	\N	\N
64	2026-03-29	Rent Collection - Latitude - Arrears before lease date.	234	3	4	1500000.00	UGX	1	2026-03-29 17:35:26.038122	\N	8	9	payment	29	f	\N	\N	89
3	2026-03-29	Payment on Account - Basinga Josephine - Galaxy Heights	123	3	8	230000.00	UGX	1	2026-03-24 08:06:42.424525	\N	2	2	payment_advance	17	f	\N	\N	89
9	2026-03-29	Rent Collection - Basinga Josephine - Arrears before lease date.	342	3	4	250000.00	UGX	1	2026-03-29 09:37:06.465695	\N	2	2	payment	18	f	\N	\N	89
68	2026-03-29	Rent Collection - Mark Mugisha - Arrears before lease date.	231	3	4	600000.00	UGX	1	2026-03-29 18:19:09.531706	\N	9	10	payment	30	f	\N	\N	89
72	2026-03-30	Rent Collection - Supermarket - Arrears before lease date.	099	3	4	480000.00	UGX	1	2026-03-30 06:04:54.082171	\N	10	11	payment	31	f	\N	\N	89
75	2026-03-30	Rent Collection - Saloon - Arrears before lease date.	123	3	4	300000.00	UGX	1	2026-03-30 06:48:05.646052	\N	10	11	payment	32	f	\N	\N	89
78	2026-03-30	Payment on Account - Namara - UK Mall	908	3	8	400000.00	UGX	1	2026-03-30 08:51:07.273117	\N	8	12	payment_advance	33	f	\N	\N	89
80	2026-03-31	Payment on Account - Basinga Josephine - Galaxy Heights	89	3	8	750000.00	UGX	1	2026-03-31 13:44:25.6885	\N	2	2	payment_advance	34	f	\N	\N	89
85	2026-04-02	Payment on Account - Sweep - Beautiful	567	3	8	700000.00	UGX	1	2026-04-02 07:20:07.997675	\N	7	8	payment_advance	35	f	\N	\N	89
49	2026-03-29	Rent Collection - We Made it - Arrears before lease date.	456	3	4	150000.00	UGX	1	2026-03-29 15:30:33.127931	\N	4	4	payment	24	f	\N	\N	89
52	2026-03-29	Rent Collection - Beloved - Arrears before lease date.	870	3	4	700000.00	UGX	1	2026-03-29 15:44:25.183805	\N	5	6	payment	25	f	\N	\N	89
12	2026-03-29	Rent Collection - Basinga Josephine - Arrears before lease date.	546	3	4	250000.00	UGX	1	2026-03-29 10:18:57.814953	\N	2	2	payment	19	f	\N	\N	89
13	2026-03-29	Rent Collection - Trial Tenant - Arrears before lease date.	908	3	4	200000.00	UGX	1	2026-03-29 10:56:30.976258	\N	2	2	payment	20	f	\N	\N	89
15	2026-03-29	Rent Collection - Fun Fanatic - Arrears before lease date.	897	3	4	600000.00	UGX	1	2026-03-29 11:07:57.953982	\N	3	3	payment	21	f	\N	\N	89
43	2026-03-29	Rent Collection - Congratulations - Arrears before lease date.	34	3	4	400000.00	UGX	1	2026-03-29 14:40:57.468425	\N	4	4	payment	23	f	\N	\N	89
90	2026-03-31	Landlord payout - New	\N	7	1	1165000.00	UGX	1	2026-04-02 15:56:54.864286	\N	7	8	landlord_payout	9	f	\N	\N	\N
119	2026-03-01	Management fee - Tester - March 2026	MGMTFEE:1:2026-03:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:31.260194	\N	1	1	mgmt_fee_summary	\N	f	\N	\N	\N
120	2026-04-01	Rent billed (gross) - Tester - April 2026	RENT-ACCRUAL:1:2026-04:UGX	4	7	1900000.00	UGX	\N	2026-04-07 15:14:31.732097	\N	1	1	rent_accrual_summary	\N	f	\N	\N	\N
91	2026-04-06	Rent Collection - Sweep - Rent for: March 2026	\N	3	4	100000.00	UGX	1	2026-04-06 11:47:44.241555	\N	7	8	payment	36	f	\N	\N	\N
121	2026-04-01	Management fee - Tester - April 2026	MGMTFEE:1:2026-04:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:32.202758	\N	1	1	mgmt_fee_summary	\N	f	\N	\N	\N
19	2026-03-29	Rent Collection - Fun Fanatic - Arrears before lease date.	453	3	4	100000.00	UGX	1	2026-03-29 11:24:52.508194	\N	3	3	payment	22	f	\N	\N	89
92	2026-04-06	Payment on Account - Sweep - Beautiful	452	3	8	850000.00	UGX	1	2026-04-06 13:53:13.002346	\N	7	8	payment_advance	37	f	\N	\N	\N
93	2026-03-23	Rent collection - Magufuli	PAYMENT:1	3	4	100000.00	UGX	1	2026-04-07 14:16:33.783368	\N	1	1	payment	1	f	\N	\N	\N
94	2026-03-23	Rent collection - Magufuli	PAYMENT:2	3	4	100000.00	UGX	1	2026-04-07 14:16:34.507437	\N	1	1	payment	2	f	\N	\N	\N
95	2026-03-23	Rent collection - Magufuli	PAYMENT:3	3	4	100000.00	UGX	1	2026-04-07 14:16:35.211698	\N	1	1	payment	3	f	\N	\N	\N
96	2026-03-23	Rent collection - Magufuli	PAYMENT:4	3	4	2000000.00	UGX	1	2026-04-07 14:16:35.913826	\N	1	1	payment	4	f	\N	\N	\N
97	2026-03-24	Rent collection - Magufuli	PAYMENT:5	3	4	245000.00	UGX	1	2026-04-07 14:16:36.621679	\N	1	1	payment	5	f	\N	\N	\N
98	2026-03-24	Rent collection - Magufuli	PAYMENT:6	3	4	440000.00	UGX	1	2026-04-07 14:16:37.321046	\N	1	1	payment	6	f	\N	\N	\N
99	2026-03-24	Rent collection - Magufuli	PAYMENT:7	3	4	55000.00	UGX	1	2026-04-07 14:16:38.04514	\N	1	1	payment	7	f	\N	\N	\N
100	2026-03-24	Rent collection - Rwatamagufa Kachope	PAYMENT:8	3	4	400000.00	UGX	1	2026-04-07 14:16:38.752675	\N	1	1	payment	8	f	\N	\N	\N
101	2026-03-24	Rent collection - Rwatamagufa Kachope	PAYMENT:9	3	4	200000.00	UGX	1	2026-04-07 14:16:39.456326	\N	1	1	payment	9	f	\N	\N	\N
102	2026-03-25	Rent collection - Rwatamagufa Kachope	PAYMENT:10	3	4	300000.00	UGX	1	2026-04-07 14:16:40.262253	\N	1	1	payment	10	f	\N	\N	\N
103	2026-03-25	Rent collection - Rwatamagufa Kachope	PAYMENT:11	3	4	157000.00	UGX	1	2026-04-07 14:16:40.963445	\N	1	1	payment	11	f	\N	\N	\N
104	2026-03-25	Rent collection - Rwatamagufa Kachope	PAYMENT:12	3	4	3000.00	UGX	1	2026-04-07 14:16:41.667291	\N	1	1	payment	12	f	\N	\N	\N
105	2026-03-25	Rent collection - Rwatamagufa Kachope	PAYMENT:13	3	4	240000.00	UGX	1	2026-04-07 14:16:42.368196	\N	1	1	payment	13	f	\N	\N	\N
106	2026-03-25	Rent collection - Rwatamagufa Kachope	PAYMENT:14	3	4	110000.00	UGX	1	2026-04-07 14:16:43.066742	\N	1	1	payment	14	f	\N	\N	\N
107	2026-03-25	Rent collection - Magufuli	PAYMENT:16	3	4	390000.00	UGX	1	2026-04-07 14:16:43.944932	\N	1	1	payment	16	f	\N	\N	\N
108	2026-03-30	Rent collection - Namara	PAYMENT:33	3	4	400000.00	UGX	1	2026-04-07 14:16:47.390893	\N	8	12	payment	33	f	\N	\N	\N
109	2026-03-31	Rent collection - Basinga Josephine	PAYMENT:34	3	4	750000.00	UGX	1	2026-04-07 14:16:48.090994	\N	2	2	payment	34	f	\N	\N	\N
110	2026-04-02	Rent collection - Sweep	PAYMENT:35	3	4	250000.00	UGX	1	2026-04-07 14:16:48.794703	\N	7	8	payment	35	f	\N	\N	\N
111	2026-04-06	Rent collection - Sweep	PAYMENT:37	3	4	600000.00	UGX	1	2026-04-07 14:16:49.689071	\N	7	8	payment	37	f	\N	\N	\N
112	2025-12-01	Rent billed (gross) - Tester - December 2025	RENT-ACCRUAL:1:2025-12:UGX	4	7	1790000.00	UGX	\N	2026-04-07 15:14:27.969308	\N	1	1	rent_accrual_summary	\N	f	\N	\N	\N
113	2025-12-01	Management fee - Tester - December 2025	MGMTFEE:1:2025-12:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:28.439558	\N	1	1	mgmt_fee_summary	\N	f	\N	\N	\N
114	2026-01-01	Rent billed (gross) - Tester - January 2026	RENT-ACCRUAL:1:2026-01:UGX	4	7	1900000.00	UGX	\N	2026-04-07 15:14:28.911547	\N	1	1	rent_accrual_summary	\N	f	\N	\N	\N
115	2026-01-01	Management fee - Tester - January 2026	MGMTFEE:1:2026-01:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:29.381578	\N	1	1	mgmt_fee_summary	\N	f	\N	\N	\N
116	2026-02-01	Rent billed (gross) - Tester - February 2026	RENT-ACCRUAL:1:2026-02:UGX	4	7	1999000.00	UGX	\N	2026-04-07 15:14:29.851538	\N	1	1	rent_accrual_summary	\N	f	\N	\N	\N
117	2026-02-01	Management fee - Tester - February 2026	MGMTFEE:1:2026-02:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:30.322615	\N	1	1	mgmt_fee_summary	\N	f	\N	\N	\N
118	2026-03-01	Rent billed (gross) - Tester - March 2026	RENT-ACCRUAL:1:2026-03:UGX	4	7	400000.00	UGX	\N	2026-04-07 15:14:30.792065	\N	1	1	rent_accrual_summary	\N	f	\N	\N	\N
122	2026-02-01	Rent billed (gross) - Galaxy Heights - February 2026	RENT-ACCRUAL:2:2026-02:UGX	4	7	911000.00	UGX	\N	2026-04-07 15:14:32.674054	\N	2	2	rent_accrual_summary	\N	f	\N	\N	\N
123	2026-02-01	Management fee - Galaxy Heights - February 2026	MGMTFEE:2:2026-02:UGX	7	14	91100.00	UGX	\N	2026-04-07 15:14:33.143777	\N	2	2	mgmt_fee_summary	\N	f	\N	\N	\N
124	2026-03-01	Rent billed (gross) - Galaxy Heights - March 2026	RENT-ACCRUAL:2:2026-03:UGX	4	7	1150000.00	UGX	\N	2026-04-07 15:14:33.61397	\N	2	2	rent_accrual_summary	\N	f	\N	\N	\N
125	2026-03-01	Management fee - Galaxy Heights - March 2026	MGMTFEE:2:2026-03:UGX	7	14	115000.00	UGX	\N	2026-04-07 15:14:34.085223	\N	2	2	mgmt_fee_summary	\N	f	\N	\N	\N
126	2026-04-01	Rent billed (gross) - Galaxy Heights - April 2026	RENT-ACCRUAL:2:2026-04:UGX	4	7	1150000.00	UGX	\N	2026-04-07 15:14:34.552915	\N	2	2	rent_accrual_summary	\N	f	\N	\N	\N
127	2026-04-01	Management fee - Galaxy Heights - April 2026	MGMTFEE:2:2026-04:UGX	7	14	115000.00	UGX	\N	2026-04-07 15:14:35.019232	\N	2	2	mgmt_fee_summary	\N	f	\N	\N	\N
128	2026-02-01	Rent billed (gross) - Danger Zone - February 2026	RENT-ACCRUAL:3:2026-02:UGX	4	7	1107000.00	UGX	\N	2026-04-07 15:14:35.490713	\N	3	3	rent_accrual_summary	\N	f	\N	\N	\N
129	2026-02-01	Management fee - Danger Zone - February 2026	MGMTFEE:3:2026-02:UGX	7	14	110700.00	UGX	\N	2026-04-07 15:14:35.959129	\N	3	3	mgmt_fee_summary	\N	f	\N	\N	\N
130	2026-03-01	Rent billed (gross) - Danger Zone - March 2026	RENT-ACCRUAL:3:2026-03:UGX	4	7	800000.00	UGX	\N	2026-04-07 15:14:36.426242	\N	3	3	rent_accrual_summary	\N	f	\N	\N	\N
131	2026-03-01	Management fee - Danger Zone - March 2026	MGMTFEE:3:2026-03:UGX	7	14	80000.00	UGX	\N	2026-04-07 15:14:36.896794	\N	3	3	mgmt_fee_summary	\N	f	\N	\N	\N
132	2026-04-01	Rent billed (gross) - Danger Zone - April 2026	RENT-ACCRUAL:3:2026-04:UGX	4	7	800000.00	UGX	\N	2026-04-07 15:14:37.365143	\N	3	3	rent_accrual_summary	\N	f	\N	\N	\N
133	2026-04-01	Management fee - Danger Zone - April 2026	MGMTFEE:3:2026-04:UGX	7	14	80000.00	UGX	\N	2026-04-07 15:14:37.833504	\N	3	3	mgmt_fee_summary	\N	f	\N	\N	\N
134	2026-02-01	Rent billed (gross) - Destiny - February 2026	RENT-ACCRUAL:4:2026-02:UGX	4	7	400000.00	UGX	\N	2026-04-07 15:14:38.302471	\N	4	4	rent_accrual_summary	\N	f	\N	\N	\N
135	2026-02-01	Management fee - Destiny - February 2026	MGMTFEE:4:2026-02:UGX	7	14	40000.00	UGX	\N	2026-04-07 15:14:38.77661	\N	4	4	mgmt_fee_summary	\N	f	\N	\N	\N
136	2026-03-01	Rent billed (gross) - Destiny - March 2026	RENT-ACCRUAL:4:2026-03:UGX	4	7	2200000.00	UGX	\N	2026-04-07 15:14:39.243957	\N	4	4	rent_accrual_summary	\N	f	\N	\N	\N
137	2026-03-01	Management fee - Destiny - March 2026	MGMTFEE:4:2026-03:UGX	7	14	220000.00	UGX	\N	2026-04-07 15:14:39.713435	\N	4	4	mgmt_fee_summary	\N	f	\N	\N	\N
138	2026-04-01	Rent billed (gross) - Destiny - April 2026	RENT-ACCRUAL:4:2026-04:UGX	4	7	2200000.00	UGX	\N	2026-04-07 15:14:40.179861	\N	4	4	rent_accrual_summary	\N	f	\N	\N	\N
139	2026-04-01	Management fee - Destiny - April 2026	MGMTFEE:4:2026-04:UGX	7	14	220000.00	UGX	\N	2026-04-07 15:14:40.647992	\N	4	4	mgmt_fee_summary	\N	f	\N	\N	\N
140	2026-03-01	Rent billed (gross) - Tested&Tried - March 2026	RENT-ACCRUAL:6:2026-03:UGX	4	7	2000000.00	UGX	\N	2026-04-07 15:14:41.131837	\N	5	6	rent_accrual_summary	\N	f	\N	\N	\N
141	2026-03-01	Management fee - Tested&Tried - March 2026	MGMTFEE:6:2026-03:UGX	7	14	200000.00	UGX	\N	2026-04-07 15:14:41.600475	\N	5	6	mgmt_fee_summary	\N	f	\N	\N	\N
142	2026-04-01	Rent billed (gross) - Tested&Tried - April 2026	RENT-ACCRUAL:6:2026-04:UGX	4	7	2000000.00	UGX	\N	2026-04-07 15:14:42.067545	\N	5	6	rent_accrual_summary	\N	f	\N	\N	\N
143	2026-04-01	Management fee - Tested&Tried - April 2026	MGMTFEE:6:2026-04:UGX	7	14	200000.00	UGX	\N	2026-04-07 15:14:42.534866	\N	5	6	mgmt_fee_summary	\N	f	\N	\N	\N
144	2026-03-01	Rent billed (gross) - Finance - March 2026	RENT-ACCRUAL:7:2026-03:UGX	4	7	1000000.00	UGX	\N	2026-04-07 15:14:43.008073	\N	6	7	rent_accrual_summary	\N	f	\N	\N	\N
145	2026-03-01	Management fee - Finance - March 2026	MGMTFEE:7:2026-03:UGX	7	14	100000.00	UGX	\N	2026-04-07 15:14:43.476025	\N	6	7	mgmt_fee_summary	\N	f	\N	\N	\N
146	2026-04-01	Rent billed (gross) - Finance - April 2026	RENT-ACCRUAL:7:2026-04:UGX	4	7	1000000.00	UGX	\N	2026-04-07 15:14:43.9477	\N	6	7	rent_accrual_summary	\N	f	\N	\N	\N
147	2026-04-01	Management fee - Finance - April 2026	MGMTFEE:7:2026-04:UGX	7	14	100000.00	UGX	\N	2026-04-07 15:14:44.419097	\N	6	7	mgmt_fee_summary	\N	f	\N	\N	\N
148	2026-02-01	Rent billed (gross) - Beautiful - February 2026	RENT-ACCRUAL:8:2026-02:UGX	4	7	250000.00	UGX	\N	2026-04-07 15:14:44.88995	\N	7	8	rent_accrual_summary	\N	f	\N	\N	\N
149	2026-02-01	Management fee - Beautiful - February 2026	MGMTFEE:8:2026-02:UGX	7	14	25000.00	UGX	\N	2026-04-07 15:14:45.362943	\N	7	8	mgmt_fee_summary	\N	f	\N	\N	\N
150	2026-03-01	Rent billed (gross) - Beautiful - March 2026	RENT-ACCRUAL:8:2026-03:UGX	4	7	700000.00	UGX	\N	2026-04-07 15:14:45.830202	\N	7	8	rent_accrual_summary	\N	f	\N	\N	\N
151	2026-03-01	Management fee - Beautiful - March 2026	MGMTFEE:8:2026-03:UGX	7	14	70000.00	UGX	\N	2026-04-07 15:14:46.302124	\N	7	8	mgmt_fee_summary	\N	f	\N	\N	\N
152	2026-04-01	Rent billed (gross) - Beautiful - April 2026	RENT-ACCRUAL:8:2026-04:UGX	4	7	700000.00	UGX	\N	2026-04-07 15:14:46.774665	\N	7	8	rent_accrual_summary	\N	f	\N	\N	\N
153	2026-04-01	Management fee - Beautiful - April 2026	MGMTFEE:8:2026-04:UGX	7	14	70000.00	UGX	\N	2026-04-07 15:14:47.245119	\N	7	8	mgmt_fee_summary	\N	f	\N	\N	\N
154	2026-03-01	Rent billed (gross) - US Mall - March 2026	RENT-ACCRUAL:9:2026-03:UGX	4	7	3000000.00	UGX	\N	2026-04-07 15:14:47.711813	\N	8	9	rent_accrual_summary	\N	f	\N	\N	\N
155	2026-03-01	Management fee - US Mall - March 2026	MGMTFEE:9:2026-03:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:48.178539	\N	8	9	mgmt_fee_summary	\N	f	\N	\N	\N
156	2026-04-01	Rent billed (gross) - US Mall - April 2026	RENT-ACCRUAL:9:2026-04:UGX	4	7	3000000.00	UGX	\N	2026-04-07 15:14:48.646518	\N	8	9	rent_accrual_summary	\N	f	\N	\N	\N
157	2026-04-01	Management fee - US Mall - April 2026	MGMTFEE:9:2026-04:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:49.123883	\N	8	9	mgmt_fee_summary	\N	f	\N	\N	\N
158	2026-03-01	Rent billed (gross) - USMall2 - March 2026	RENT-ACCRUAL:10:2026-03:UGX	4	7	1400000.00	UGX	\N	2026-04-07 15:14:49.590262	\N	9	10	rent_accrual_summary	\N	f	\N	\N	\N
159	2026-03-01	Management fee - USMall2 - March 2026	MGMTFEE:10:2026-03:UGX	7	14	140000.00	UGX	\N	2026-04-07 15:14:50.055607	\N	9	10	mgmt_fee_summary	\N	f	\N	\N	\N
160	2026-04-01	Rent billed (gross) - USMall2 - April 2026	RENT-ACCRUAL:10:2026-04:UGX	4	7	1400000.00	UGX	\N	2026-04-07 15:14:50.52507	\N	9	10	rent_accrual_summary	\N	f	\N	\N	\N
161	2026-04-01	Management fee - USMall2 - April 2026	MGMTFEE:10:2026-04:UGX	7	14	140000.00	UGX	\N	2026-04-07 15:14:50.995413	\N	9	10	mgmt_fee_summary	\N	f	\N	\N	\N
162	2026-03-01	Rent billed (gross) - West Mall - March 2026	RENT-ACCRUAL:11:2026-03:UGX	4	7	1500000.00	UGX	\N	2026-04-07 15:14:51.461412	\N	10	11	rent_accrual_summary	\N	f	\N	\N	\N
163	2026-03-01	Management fee - West Mall - March 2026	MGMTFEE:11:2026-03:UGX	7	14	150000.00	UGX	\N	2026-04-07 15:14:53.783369	\N	10	11	mgmt_fee_summary	\N	f	\N	\N	\N
164	2026-04-01	Rent billed (gross) - West Mall - April 2026	RENT-ACCRUAL:11:2026-04:UGX	4	7	1500000.00	UGX	\N	2026-04-07 15:14:54.251903	\N	10	11	rent_accrual_summary	\N	f	\N	\N	\N
165	2026-04-01	Management fee - West Mall - April 2026	MGMTFEE:11:2026-04:UGX	7	14	150000.00	UGX	\N	2026-04-07 15:14:54.718996	\N	10	11	mgmt_fee_summary	\N	f	\N	\N	\N
166	2026-01-01	Rent billed (gross) - UK Mall - January 2026	RENT-ACCRUAL:12:2026-01:UGX	4	7	30000.00	UGX	\N	2026-04-07 15:14:55.187424	\N	8	12	rent_accrual_summary	\N	f	\N	\N	\N
167	2026-01-01	Management fee - UK Mall - January 2026	MGMTFEE:12:2026-01:UGX	7	14	30000.00	UGX	\N	2026-04-07 15:14:55.654263	\N	8	12	mgmt_fee_summary	\N	f	\N	\N	\N
168	2026-03-01	Rent billed (gross) - UK Mall - March 2026	RENT-ACCRUAL:12:2026-03:UGX	4	7	1020000.00	UGX	\N	2026-04-07 15:14:56.134314	\N	8	12	rent_accrual_summary	\N	f	\N	\N	\N
169	2026-03-01	Management fee - UK Mall - March 2026	MGMTFEE:12:2026-03:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:56.601713	\N	8	12	mgmt_fee_summary	\N	f	\N	\N	\N
170	2026-04-01	Rent billed (gross) - UK Mall - April 2026	RENT-ACCRUAL:12:2026-04:UGX	4	7	1050000.00	UGX	\N	2026-04-07 15:14:57.06903	\N	8	12	rent_accrual_summary	\N	f	\N	\N	\N
171	2026-04-01	Management fee - UK Mall - April 2026	MGMTFEE:12:2026-04:UGX	7	14	300000.00	UGX	\N	2026-04-07 15:14:57.537071	\N	8	12	mgmt_fee_summary	\N	f	\N	\N	\N

\.
