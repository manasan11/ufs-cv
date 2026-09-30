CREATE TABLE IF NOT EXISTS users (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(200) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name     VARCHAR(120) NOT NULL,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cvs (
  id         INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_id   INT UNSIGNED NULL,
  full_name  VARCHAR(120) NOT NULL,
  email      VARCHAR(200) NOT NULL,
  phone      VARCHAR(40)  NULL,
  headline   VARCHAR(160) NULL,
  location   VARCHAR(160) NULL,
  summary    TEXT         NULL,
  created_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_cvs_owner (owner_id),
  KEY idx_cvs_created_at (created_at),
  KEY idx_cvs_updated_at (updated_at),
  KEY idx_cvs_full_name (full_name),
  KEY idx_cvs_email (email),
  CONSTRAINT fk_cvs_owner FOREIGN KEY (owner_id) REFERENCES users (id) ON DELETE SET NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cv_experiences (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cv_id       INT UNSIGNED NOT NULL,
  position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  job_title   VARCHAR(120) NOT NULL,
  company     VARCHAR(120) NOT NULL,
  location    VARCHAR(120) NULL,
  start_date  DATE         NOT NULL,
  end_date    DATE         NULL,
  is_current  TINYINT(1)   NOT NULL DEFAULT 0,
  description TEXT         NULL,
  PRIMARY KEY (id),
  KEY idx_cv_experiences_cv (cv_id, position),
  CONSTRAINT fk_cv_experiences_cv FOREIGN KEY (cv_id) REFERENCES cvs (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cv_education (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cv_id        INT UNSIGNED NOT NULL,
  position     SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  institution  VARCHAR(160) NOT NULL,
  degree       VARCHAR(120) NULL,
  field_of_study VARCHAR(120) NULL,
  start_date   DATE         NULL,
  end_date     DATE         NULL,
  grade        VARCHAR(60)  NULL,
  description  TEXT         NULL,
  PRIMARY KEY (id),
  KEY idx_cv_education_cv (cv_id, position),
  CONSTRAINT fk_cv_education_cv FOREIGN KEY (cv_id) REFERENCES cvs (id) ON DELETE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS cv_skills (
  id          INT UNSIGNED  NOT NULL AUTO_INCREMENT,
  cv_id       INT UNSIGNED  NOT NULL,
  position    SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  name        VARCHAR(60)   NOT NULL,
  category    VARCHAR(40)   NULL,
  proficiency TINYINT UNSIGNED NULL,
  PRIMARY KEY (id),
  KEY idx_cv_skills_cv (cv_id, position),
  CONSTRAINT fk_cv_skills_cv FOREIGN KEY (cv_id) REFERENCES cvs (id) ON DELETE CASCADE,
  CONSTRAINT chk_cv_skills_proficiency CHECK (proficiency IS NULL OR proficiency BETWEEN 1 AND 5)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
