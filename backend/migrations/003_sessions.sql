CREATE TABLE sessions_knex (
    sid VARCHAR(255) NOT NULL,

    sess JSON NOT NULL,

    expired DATETIME NOT NULL,

    PRIMARY KEY (sid)
);