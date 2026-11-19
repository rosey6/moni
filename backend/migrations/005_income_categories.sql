CREATE TABLE IF NOT EXISTS schema_migrations (
    version VARCHAR(100) NOT NULL PRIMARY KEY,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

INSERT INTO categories (slug, nom) VALUES
    ('salary', 'Salaire'),
    ('scholarship', 'Bourse d’études'),
    ('family_support', 'Aide familiale'),
    ('freelance', 'Freelance'),
    ('other_income', 'Autres revenus')
ON DUPLICATE KEY UPDATE nom = VALUES(nom);

INSERT IGNORE INTO schema_migrations (version) VALUES ('005_income_categories');
