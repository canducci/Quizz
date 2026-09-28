import { getTableConfig as pgConfig, PgTable } from "drizzle-orm/pg-core";
import { getTableConfig as sqliteConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import { expect, expectTypeOf, it } from "vitest";
import * as app from "./schema";
import * as pg from "./schema.pg";
import * as sqlite from "./schema.sqlite";

/** What both dialects must agree on; column types differ by design (ADR 0007). */
function shape(config: ReturnType<typeof pgConfig> | ReturnType<typeof sqliteConfig>) {
  return {
    name: config.name,
    columns: config.columns.map((c) => [c.name, c.notNull, c.primary, c.isUnique, c.default]),
    indexes: config.indexes.map((i) => [i.config.name, i.config.unique, i.config.where != null]),
    primaryKeys: config.primaryKeys.map((k) => k.columns.map((c) => c.name)),
    foreignKeys: config.foreignKeys.map((f) => {
      const { columns, foreignColumns } = f.reference();
      return [
        columns.map((c) => c.name),
        foreignColumns.map((c) => c.name),
        f.onDelete ?? "no action",
      ];
    }),
  };
}

it("keeps the Postgres schema column for column like the SQLite one", () => {
  expect(Object.keys(pg).sort()).toEqual(Object.keys(sqlite).sort());
  for (const [name, table] of Object.entries(sqlite)) {
    if (!(table instanceof SQLiteTable)) continue;
    const twin = pg[name as keyof typeof pg];
    expect(twin, name).toBeInstanceOf(PgTable);
    expect(shape(pgConfig(twin as PgTable)), name).toEqual(shape(sqliteConfig(table)));
  }
});

it("hands the app every table and constant of the schema", () => {
  expect(Object.keys(app).sort()).toEqual(Object.keys(sqlite).sort());
});

it("gives the app the same row types on both", () => {
  type Rows<S> = { [K in keyof S]: S[K] extends { $inferSelect: infer R } ? R : never };
  expectTypeOf<Rows<typeof pg>>().toEqualTypeOf<Rows<typeof sqlite>>();
});
