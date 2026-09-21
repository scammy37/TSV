const { describeDatabase } = require('../config');

describe('describeDatabase', () => {
  it('names the database from discrete settings', () => {
    expect(describeDatabase({ database: 'tsv_db' })).toBe('tsv_db');
  });

  it('names the database and host from a connection string', () => {
    expect(describeDatabase({
      connectionString: 'postgresql://user:pw@dpg-abc.oregon-postgres.render.com:5432/tsv_db',
    })).toBe('tsv_db on dpg-abc.oregon-postgres.render.com:5432');
  });

  it('never puts the password in the label', () => {
    // The label goes into deploy logs, which get pasted into issue trackers.
    const label = describeDatabase({
      connectionString: 'postgresql://tsvuser:sup3r-s3cret-pw@db.internal:5432/tsv_db',
    });
    expect(label).not.toContain('sup3r-s3cret-pw');
    expect(label).not.toContain('tsvuser');
  });

  it('falls back to something printable for a string URL cannot parse', () => {
    // libpq also accepts keyword strings, which WHATWG URL rejects.
    expect(describeDatabase({ connectionString: 'host=db.internal dbname=tsv password=pw' }))
      .toBe('the configured database');
  });

  it('survives a connection string with no database name', () => {
    expect(describeDatabase({ connectionString: 'postgresql://u:p@db.internal:5432' }))
      .toBe('db.internal:5432');
  });
});
