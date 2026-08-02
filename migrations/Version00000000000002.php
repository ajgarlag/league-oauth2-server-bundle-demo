<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260722102440 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE oauth2_device_code (identifier CHAR(80) NOT NULL, expiry DATETIME NOT NULL, user_identifier VARCHAR(128) DEFAULT NULL, scopes CLOB DEFAULT NULL, revoked BOOLEAN NOT NULL, user_code VARCHAR(255) DEFAULT NULL, user_approved BOOLEAN NOT NULL, include_verification_uri_complete BOOLEAN NOT NULL, verification_uri VARCHAR(255) DEFAULT NULL, last_polled_at DATETIME DEFAULT NULL, "interval" INTEGER NOT NULL, client VARCHAR(32) NOT NULL, PRIMARY KEY(identifier), CONSTRAINT FK_A816B6B0C7440455 FOREIGN KEY (client) REFERENCES oauth2_client (identifier) ON DELETE CASCADE NOT DEFERRABLE INITIALLY IMMEDIATE)');
        $this->addSql('CREATE INDEX IDX_A816B6B0C7440455 ON oauth2_device_code (client)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('DROP TABLE oauth2_device_code');
    }
}
