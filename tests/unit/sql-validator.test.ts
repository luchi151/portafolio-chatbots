import { describe, expect, it } from 'vitest';
import { validateSQL } from '@/lib/sql-validator';

describe('validateSQL — valid queries', () => {
  it('allows basic SELECT *', () => {
    expect(validateSQL('SELECT * FROM customers').valid).toBe(true);
  });

  it('allows SELECT with WHERE', () => {
    expect(validateSQL("SELECT name, debt_amount FROM customers WHERE debt_status = 'active'").valid).toBe(true);
  });

  it('allows SELECT with JOIN', () => {
    expect(
      validateSQL(
        'SELECT c.name, conv.demo_type FROM customers c LEFT JOIN conversations conv ON conv.session_id = c.id',
      ).valid,
    ).toBe(true);
  });

  it('allows aggregation + GROUP BY', () => {
    expect(
      validateSQL(
        'SELECT debt_status, COUNT(*) AS total, SUM(debt_amount) AS suma FROM customers GROUP BY debt_status',
      ).valid,
    ).toBe(true);
  });

  it('allows WITH (CTE)', () => {
    expect(
      validateSQL('WITH top_debt AS (SELECT id, debt_amount FROM customers ORDER BY debt_amount DESC LIMIT 5) SELECT * FROM top_debt').valid,
    ).toBe(true);
  });

  it('allows ORDER BY + LIMIT + OFFSET', () => {
    expect(validateSQL('SELECT name FROM customers ORDER BY debt_amount DESC LIMIT 10 OFFSET 0').valid).toBe(true);
  });

  it('allows CASE WHEN', () => {
    expect(
      validateSQL("SELECT name, CASE WHEN debt_amount > 1000000 THEN 'alto' ELSE 'bajo' END FROM customers").valid,
    ).toBe(true);
  });

  it('allows a single trailing semicolon', () => {
    expect(validateSQL('SELECT * FROM customers;').valid).toBe(true);
  });

  it('allows a trailing semicolon with surrounding whitespace', () => {
    expect(validateSQL('SELECT * FROM customers ;  \n').valid).toBe(true);
  });
});

describe('validateSQL — blocked keywords', () => {
  const blocked = [
    ['DROP TABLE', 'DROP TABLE customers'],
    ['DELETE', 'DELETE FROM customers WHERE 1=1'],
    ['INSERT', "INSERT INTO customers (name) VALUES ('x')"],
    ['UPDATE', "UPDATE customers SET name = 'x'"],
    ['ALTER', 'ALTER TABLE customers ADD COLUMN foo TEXT'],
    ['CREATE', 'CREATE TABLE foo (id INT)'],
    ['TRUNCATE', 'TRUNCATE TABLE customers'],
    ['GRANT', 'GRANT ALL ON customers TO public'],
    ['EXEC', 'EXEC sp_something'],
    ['EXECUTE', 'EXECUTE sp_something'],
  ] as const;

  blocked.forEach(([kw, sql]) => {
    it(`blocks ${kw}`, () => {
      const result = validateSQL(sql);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  it('blocks lowercase keyword variants', () => {
    expect(validateSQL('drop table customers').valid).toBe(false);
  });

  it('blocks mixed-case keyword variants', () => {
    expect(validateSQL('DeLeTe FROM customers').valid).toBe(false);
  });

  it('does not false-positive on identifiers containing a blocked keyword as substring', () => {
    expect(validateSQL('SELECT dropped_at, called_count FROM customers').valid).toBe(true);
  });
});

describe('validateSQL — injection patterns', () => {
  it('blocks line comment (--)', () => {
    const result = validateSQL('SELECT * FROM customers -- ; DROP TABLE customers');
    expect(result.valid).toBe(false);
  });

  it('blocks block comment (/* */)', () => {
    const result = validateSQL('SELECT /* DROP TABLE customers */ * FROM customers');
    expect(result.valid).toBe(false);
  });

  it('rejects non-SELECT start', () => {
    const result = validateSQL("SHOW TABLES");
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/SELECT/i);
  });

  it('rejects empty string', () => {
    const result = validateSQL('');
    expect(result.valid).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    const result = validateSQL('   ');
    expect(result.valid).toBe(false);
  });

  it('blocks stacked statements even when the second statement has no blocked keyword', () => {
    // Both halves are plain SELECTs — the keyword blocklist alone would miss this.
    const result = validateSQL('SELECT * FROM customers; SELECT pg_sleep(10)');
    expect(result.valid).toBe(false);
  });

  it('blocks stacked statements smuggling a blocked keyword after the semicolon', () => {
    const result = validateSQL('SELECT 1; DROP TABLE customers');
    expect(result.valid).toBe(false);
  });

  it('blocks a semicolon-separated statement disguised via a comment-free split', () => {
    const result = validateSQL('SELECT * FROM customers WHERE id = 1; SELECT * FROM users');
    expect(result.valid).toBe(false);
  });

  it('blocks nested/multiple block comments used to smuggle a keyword', () => {
    const result = validateSQL('SELECT * FROM customers /* comment */ /* DROP TABLE x */');
    expect(result.valid).toBe(false);
  });

  it('blocks a keyword split across a block comment', () => {
    // "DR" + comment + "OP" would evade a naive \bDROP\b check if comments were stripped first.
    const result = validateSQL('SELECT * FROM customers; DR/**/OP TABLE customers');
    expect(result.valid).toBe(false);
  });
});
