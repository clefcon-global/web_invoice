/**
 * Minimal D1-shaped in-memory test double for worker/src/auth.js and
 * worker/src/counters.js. Matches their exact SQL statements by normalized
 * text rather than parsing SQL generally — the statements are fixed and
 * owned alongside this file.
 *
 * Every statement executes behind a single serialized queue with a forced
 * async boundary, mirroring D1's single-writer, one-statement-at-a-time
 * execution. That's what makes the concurrency tests meaningful: code that
 * split an atomic increment into a separate read then write would show
 * duplicates under Promise.all here, the same way it would against real D1.
 */

function clone(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

export function createFakeD1(seed) {
  const state = clone(seed);
  let queue = Promise.resolve();

  function serialize(fn) {
    const result = queue.then(async () => {
      await Promise.resolve(); // forces a real async boundary, like a network round trip
      return fn();
    });
    queue = result.then(
      () => {},
      () => {},
    );
    return result;
  }

  function execute(sql, params) {
    const normalized = sql.replace(/\s+/g, ' ').trim();

    if (normalized === 'UPDATE counters SET value = value + 1 WHERE name = ?1 RETURNING value') {
      const [name] = params;
      const row = state.counters.find((counter) => counter.name === name);
      if (!row) return { results: [] };
      row.value += 1;
      return { results: [{ value: row.value }] };
    }

    if (normalized === 'SELECT locked_until FROM auth_state WHERE id = 1') {
      return { results: [{ locked_until: state.auth_state.locked_until }] };
    }

    if (normalized === 'SELECT fail_count, first_fail_at FROM auth_state WHERE id = 1') {
      return {
        results: [{ fail_count: state.auth_state.fail_count, first_fail_at: state.auth_state.first_fail_at }],
      };
    }

    if (
      normalized
      === 'UPDATE auth_state SET fail_count = ?1, first_fail_at = ?2, locked_until = ?3 WHERE id = 1'
    ) {
      const [failCount, firstFailAt, lockedUntil] = params;
      Object.assign(state.auth_state, {
        fail_count: failCount,
        first_fail_at: firstFailAt,
        locked_until: lockedUntil,
      });
      return { results: [] };
    }

    if (normalized === 'UPDATE auth_state SET fail_count = 0, first_fail_at = NULL, locked_until = NULL WHERE id = 1') {
      Object.assign(state.auth_state, { fail_count: 0, first_fail_at: null, locked_until: null });
      return { results: [] };
    }

    throw new Error(`fakeD1: unrecognized statement: ${normalized}`);
  }

  function makeStatement(sql) {
    let boundParams = [];
    return {
      bind(...params) {
        boundParams = params;
        return this;
      },
      async first(column) {
        const { results } = await serialize(() => execute(sql, boundParams));
        const row = results[0] ?? null;
        return column ? (row?.[column] ?? null) : row;
      },
      async run() {
        const { results } = await serialize(() => execute(sql, boundParams));
        return { results, meta: {} };
      },
    };
  }

  return {
    prepare(sql) {
      return makeStatement(sql);
    },
    async batch(statements) {
      const results = [];
      for (const statement of statements) {
        results.push(await statement.run());
      }
      return results;
    },
    _state: state,
  };
}
