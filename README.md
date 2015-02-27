Moo!
====

Init the SQL database with this:
--------------------------------

CREATE TABLE `definitions` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `question` varchar(100) COLLATE utf8_estonian_ci NOT NULL,
  `answer` text COLLATE utf8_estonian_ci NOT NULL,
  `created` timestamp NULL DEFAULT NULL,
  `modified` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `general` (`question`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

CREATE TABLE `logs` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `target` varchar(30) COLLATE utf8_estonian_ci DEFAULT NULL,
  `nick` varchar(30) COLLATE utf8_estonian_ci DEFAULT NULL,
  `userhost` varchar(100) COLLATE utf8_estonian_ci DEFAULT NULL,
  `act` varchar(30) COLLATE utf8_estonian_ci NOT NULL,
  `text` text COLLATE utf8_estonian_ci,
  `time` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `logs` (`id`,`target`,`act`,`time`)
) ENGINE=MyISAM DEFAULT CHARSET=utf8 COLLATE=utf8_estonian_ci;

