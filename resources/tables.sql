USE `websocket-server`;
CREATE TABLE IF NOT EXISTS `users`
(
    `id`            INT          NOT NULL AUTO_INCREMENT,
    `username`      VARCHAR(50)  NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `email`         VARCHAR(100) NOT NULL,
    `created_at`    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `username_UNIQUE` (`username` ASC)
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `devices`
(
    `id`                 INT          NOT NULL AUTO_INCREMENT,
    `unique_hardware_id` VARCHAR(100) NOT NULL,
    `user_id`            INT          NOT NULL,
    `alias`              VARCHAR(100) NULL,
    `created_at`         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `unique_hardware_id_UNIQUE` (`unique_hardware_id` ASC),
    INDEX `fk_user_idx` (`user_id` ASC),
    CONSTRAINT `fk_user`
        FOREIGN KEY (`user_id`)
            REFERENCES `users` (`id`)
            ON DELETE CASCADE
            ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `binding_tokens`
(
    `id`         INT          NOT NULL AUTO_INCREMENT,
    `token`      VARCHAR(100) NOT NULL,
    `user_id`    INT          NOT NULL,
    `is_used`   BOOLEAN      NOT NULL DEFAULT FALSE,
    `expires_at` TIMESTAMP    NOT NULL,
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE INDEX `token_UNIQUE` (`token` ASC),
    INDEX `fk_user_idx` (`user_id` ASC),
    CONSTRAINT `fk_user_token`
        FOREIGN KEY (`user_id`)
            REFERENCES `users` (`id`)
            ON DELETE CASCADE
            ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `temp_humi_data`
(
  `id` INT NOT NULL AUTO_INCREMENT,
  `unique_hardware_id` VARCHAR(100) NOT NULL,
  `temperature` DECIMAL(5, 2) NOT NULL,
  `humidity` DECIMAL(5, 2) NOT NULL,
  `ts`         BIGINT       NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_unique_hardware_id_ts_UNIQUE` (`unique_hardware_id` ASC, `ts` ASC),
  CONSTRAINT `fk_device_temp_humi`
    FOREIGN KEY (`unique_hardware_id`)
      REFERENCES `devices` (`unique_hardware_id`)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `pir_data`
(
  `id` INT NOT NULL AUTO_INCREMENT,
  `unique_hardware_id` VARCHAR(100) NOT NULL,
  `state` BOOLEAN NOT NULL,
  `ts` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_unique_hardware_id_ts_UNIQUE` (`unique_hardware_id` ASC, `ts` ASC),
  CONSTRAINT `fk_device_pir`
    FOREIGN KEY (`unique_hardware_id`)
      REFERENCES `devices` (`unique_hardware_id`)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `switch_data`
(
  `id` INT NOT NULL AUTO_INCREMENT,
  `unique_hardware_id` VARCHAR(100) NOT NULL,
  `state` BOOLEAN NOT NULL,
  `ts` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_unique_hardware_id_ts_UNIQUE` (`unique_hardware_id` ASC, `ts` ASC),
  CONSTRAINT `fk_device_switch`
    FOREIGN KEY (`unique_hardware_id`)
      REFERENCES `devices` (`unique_hardware_id`)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `radar_data`
(
  `id` INT NOT NULL AUTO_INCREMENT,
  `unique_hardware_id` VARCHAR(100) NOT NULL,
  `state` BOOLEAN NOT NULL,
  `ts` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_unique_hardware_id_ts_UNIQUE` (`unique_hardware_id` ASC, `ts` ASC),
  CONSTRAINT `fk_device_radar`
    FOREIGN KEY (`unique_hardware_id`)
      REFERENCES `devices` (`unique_hardware_id`)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `sound_data`
(
  `id` INT NOT NULL AUTO_INCREMENT,
  `unique_hardware_id` VARCHAR(100) NOT NULL,
  `ts` BIGINT NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `idx_unique_hardware_id_ts_UNIQUE` (`unique_hardware_id` ASC, `ts` ASC),
  CONSTRAINT `fk_device_sound`
    FOREIGN KEY (`unique_hardware_id`)
      REFERENCES `devices` (`unique_hardware_id`)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;

CREATE TABLE IF NOT EXISTS `device_configs`
(
  `id` INT NOT NULL AUTO_INCREMENT,
  `unique_hardware_id` VARCHAR(100) NOT NULL,
  `automation_mode` ENUM('off', 'presence', 'sound', 'timer', 'ml') NOT NULL DEFAULT 'off',
  `presence_mode` ENUM('pir_only', 'radar_only', 'fusion_or', 'fusion_and') NOT NULL DEFAULT 'fusion_or',
  `sensor_off_delay` INT NOT NULL DEFAULT 30,
  `mqtt_device_name` VARCHAR(100) NULL,
  `mqtt_broker_url` VARCHAR(255) NULL,
  `mqtt_port` INT NULL,
  `mqtt_username` VARCHAR(100) NULL,
  `mqtt_password` VARCHAR(255) NULL,
  `mqtt_client_id` VARCHAR(100) NULL,
  `mqtt_topic_prefix` VARCHAR(255) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unique_hardware_id_UNIQUE` (`unique_hardware_id` ASC),
  CONSTRAINT `fk_device_config`
    FOREIGN KEY (`unique_hardware_id`)
      REFERENCES `devices` (`unique_hardware_id`)
      ON DELETE CASCADE
      ON UPDATE NO ACTION
) ENGINE = InnoDB
  DEFAULT CHARSET = utf8mb4;