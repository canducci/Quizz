/** The database is Postgres if its URL says so, else SQLite (ADR 0007). */
export const isPostgres = (url = process.env.DATABASE_URL ?? "") => /^postgres(ql)?:\/\//.test(url);
